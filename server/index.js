require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Pool } = require('pg');
const dns = require('dns');

// Force IPv4 resolution to avoid IPv6 connection issues
dns.setDefaultResultOrder('ipv4first');

const { authenticate, authorize } = require('./middleware/auth');
const logAudit = require('./middleware/audit');
const { calculateScore } = require('./services/scoring'); // FR-D.2
const trackingRoutes = require('./routes/tracking');      // FR-D.1
const userRoutes = require('./routes/users');             // Admin User Mgmt
const { renderTemplate } = require('./services/templates'); // FR-D.3

// -- Configuration --
const app = express();
const PORT = process.env.PORT || 5000;

// -- Database Connection --
// -- Database Connection --
const rawUrl = process.env.DATABASE_URL || 'postgresql://sssi_user:sssi_password@localhost:5432/sssi_growthengine';
let pool;

const startServer = async () => {
    let connectionString = rawUrl;

    // FIX: Explicitly resolve hostname to IPv4 to prevent ENETUNREACH on IPv6-only environments (like Render)
    try {
        const { URL } = require('url');
        const parsed = new URL(rawUrl);

        // Resolve if it's a hostname (not IP) and not localhost
        if (parsed.hostname && parsed.hostname !== 'localhost' && !parsed.hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
            console.log(`[DNS] Resolving Host: ${parsed.hostname} via Google DNS...`);
            try {
                // Use Google DNS servers (8.8.8.8) to ensure we get an IPv4 A-record (Bypassing Render ENODATA)
                dns.setServers(['8.8.8.8', '8.8.4.4']);

                const { resolve4 } = dns.promises;
                const addresses = await resolve4(parsed.hostname);

                if (addresses && addresses.length > 0) {
                    console.log(`[DNS] Resolved to IPv4: ${addresses[0]}`);
                    parsed.hostname = addresses[0];
                    connectionString = parsed.toString();
                } else {
                    console.warn('[DNS] Google DNS returned no IPv4 addresses.');
                }
            } catch (e) {
                console.warn(`[DNS] IPv4 Resolution Failed: ${e.message}`);
            }
        }
    } catch (err) {
        console.warn('[DNS] Setup Error:', err.message);
    }

    const poolConfig = {
        connectionString,
        ssl: rawUrl.includes('supabase.co') ? { rejectUnauthorized: false } : false
    };

    pool = new Pool(poolConfig);

    pool.on('error', (err) => {
        console.error('Unexpected error on idle client', err);
        process.exit(-1);
    });

    // Test Connection Immediately
    try {
        const client = await pool.connect();
        console.log('✅ Connected to Database');
        client.release();
    } catch (err) {
        console.error('----------------------------------------');
        console.error('❌ DATABASE CONNECTION FAILED');
        console.error(err.message);
        console.error('----------------------------------------');
    }

    // -- Start Server --
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
};

startServer();

// Root Route for Deployment Check
app.get('/', (req, res) => {
    res.json({ message: 'SSSI Growth Engine API is Running 🚀' });
});

// -- Middleware --
app.use(helmet());
app.use(cors({
    origin: '*', // Allow all origins for now to fix the Netlify issue
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(morgan('dev'));
app.use(express.json());

// Attach DB Pool to Request for Middleware access
app.use((req, res, next) => {
    req.db = pool;
    next();
});

// Apply Custom Middleware
app.use(authenticate); // Simulate extracting user
app.use(logAudit(pool)); // Attach audit helper

// FR-D.3: Template Preview API
app.post('/api/templates/preview', authorize(['admin', 'manager', 'rep']), async (req, res) => {
    const { template, contextId, type } = req.body;
    try {
        const rendered = await renderTemplate(pool, template, contextId, type);
        res.json({ rendered });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// -- Routes --
app.use('/api/track', trackingRoutes(pool)); // Mount Pixel Tracking at /api/track/pixel/:id
app.use('/api/users', userRoutes);           // Mount User Management

// ── FR-A.2: Global Search API ──────────────────────────────────────────────
// GET /api/search?q=<term>&limit=<n>
// Uses GIN trigram indexes (pg_trgm) + B-Tree indexes for fast ILIKE matching.
// Returns results from contacts, companies, deals, and users (team members).
app.get('/api/search', authorize(['admin', 'manager', 'rep', 'intern']), async (req, res) => {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) {
        return res.json({ results: [] });
    }

    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const term = `%${q}%`; // ILIKE pattern – hits GIN trigram indexes
    const t0 = process.hrtime.bigint(); // high-res timer for latency measurement

    try {
        // ── 1. Contacts: match name, email, phone ──────────────────
        const contactsQuery = `
            SELECT
                cont_id   AS id,
                'contact' AS type,
                (first_name || ' ' || last_name) AS title,
                email     AS subtitle,
                phone     AS meta,
                NULL      AS url_id
            FROM contacts
            WHERE
                first_name ILIKE $1 OR
                last_name  ILIKE $1 OR
                (first_name || ' ' || last_name) ILIKE $1 OR
                email ILIKE $1 OR
                phone ILIKE $1
            ORDER BY last_name, first_name
            LIMIT $2
        `;

        // ── 2. Companies: match name, domain ──────────────────────
        const companiesQuery = `
            SELECT
                comp_id   AS id,
                'company' AS type,
                name      AS title,
                domain    AS subtitle,
                industry  AS meta,
                NULL      AS url_id
            FROM companies
            WHERE
                name   ILIKE $1 OR
                domain ILIKE $1
            ORDER BY name
            LIMIT $2
        `;

        // ── 3. Deals: match name, offering, remark ────────────────
        // RBAC: reps/interns only see their own deals
        let dealsFilter = '';
        const dealsParams = [term, limit];
        if (req.user.role === 'rep' || req.user.role === 'intern') {
            dealsFilter = 'AND d.owner_id = $3';
            dealsParams.push(req.user.id);
        } else if (req.user.role === 'manager') {
            dealsFilter = 'AND (d.owner_id = $3 OR d.owner_id IN (SELECT user_id FROM users WHERE manager_id = $3))';
            dealsParams.push(req.user.id);
        }

        const dealsQuery = `
            SELECT
                d.deal_id   AS id,
                'deal'      AS type,
                d.name      AS title,
                d.stage     AS subtitle,
                c.name      AS meta,
                d.deal_id   AS url_id
            FROM deals d
            LEFT JOIN companies c ON d.comp_id = c.comp_id
            WHERE (
                d.name     ILIKE $1 OR
                d.offering ILIKE $1 OR
                d.remark   ILIKE $1
            ) ${dealsFilter}
            ORDER BY d.updated_at DESC
            LIMIT $2
        `;

        // ── 4. Users (team members): match name, email, phone ─────
        // Only admin & manager can see full team directory
        let usersRows = [];
        if (req.user.role === 'admin' || req.user.role === 'manager') {
            const usersResult = await pool.query(`
                SELECT
                    user_id   AS id,
                    'user'    AS type,
                    COALESCE(full_name, email) AS title,
                    email     AS subtitle,
                    role      AS meta,
                    NULL      AS url_id
                FROM users
                WHERE
                    full_name ILIKE $1 OR
                    email     ILIKE $1 OR
                    phone     ILIKE $1
                ORDER BY full_name
                LIMIT $2
            `, [term, limit]);
            usersRows = usersResult.rows;
        }

        // Run contacts, companies, deals queries in parallel
        const [contactsResult, companiesResult, dealsResult] = await Promise.all([
            pool.query(contactsQuery, [term, limit]),
            pool.query(companiesQuery, [term, limit]),
            pool.query(dealsQuery, dealsParams),
        ]);

        // Merge & return unified result list
        const results = [
            ...contactsResult.rows,
            ...companiesResult.rows,
            ...dealsResult.rows,
            ...usersRows,
        ];

        // Calculate DB latency and expose via header (proves FR-A.2 < 150 ms requirement)
        const elapsedMs = Math.round(Number(process.hrtime.bigint() - t0) / 1_000_000);
        res.setHeader('X-Search-Time-Ms', elapsedMs);
        res.setHeader('X-Search-Count', results.length);
        res.setHeader('Access-Control-Expose-Headers', 'X-Search-Time-Ms, X-Search-Count');

        res.json({ results, query: q, latency_ms: elapsedMs });
    } catch (err) {
        console.error('[Search] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Admin Export API
app.get('/api/export/deals', authorize(['admin']), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT d.name, c.name as company, d.value, d.stage, d.probability, d.closing_date, u.email as owner
            FROM deals d
            LEFT JOIN companies c ON d.comp_id = c.comp_id
            LEFT JOIN users u ON d.owner_id = u.user_id
            ORDER BY d.created_at DESC
        `);

        // Convert to CSV
        const fields = ['name', 'company', 'value', 'stage', 'probability', 'closing_date', 'owner'];
        const csv = [
            fields.join(','),
            ...result.rows.map(row => fields.map(field => JSON.stringify(row[field] || '')).join(','))
        ].join('\n');

        res.header('Content-Type', 'text/csv');
        res.attachment('deals-export.csv');
        res.send(csv);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// FR-D.2: Lead Scoring API
app.get('/api/contacts/:id/score', authorize(['admin', 'manager', 'rep']), async (req, res) => {
    try {
        const result = await calculateScore(pool, req.params.id);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});
app.get('/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({
            status: 'ok',
            timestamp: result.rows[0].now,
            service: 'SSSI GrowthEngine API',
            user: req.user // Debug: show current user
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: 'Database connection failed' });
    }
});

// User Profile API
app.get('/api/me', authenticate, async (req, res) => {
    // req.user already contains { id, role, email } populated by auth middleware
    res.json(req.user);
});

// FR-A.1: Companies API
app.post('/api/companies', authorize(['admin', 'manager', 'rep']), async (req, res) => {
    const { name, domain, industry, revenue } = req.body;
    try {
        console.log('[CreateCompany] Starting...');

        // Check for duplicate
        const existing = await pool.query('SELECT comp_id FROM companies WHERE name ILIKE $1', [name]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Company name already exists' });
        }

        const result = await pool.query(
            `INSERT INTO companies (name, domain, industry, revenue) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
            [name, domain, industry, revenue]
        );
        console.log('[CreateCompany] Inserted company');
        const newCompany = result.rows[0];

        // Audit Log
        console.log('[CreateCompany] Auditing...');
        await req.audit('CREATE', 'COMPANY', newCompany.comp_id, null, newCompany);
        console.log('[CreateCompany] Audited');

        res.status(201).json(newCompany);
    } catch (err) {
        console.error('[CreateCompany] Failed:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/companies', authorize(['admin', 'manager', 'rep', 'intern']), async (req, res) => {
    try {
        // Simple pagination could be added here
        const result = await pool.query('SELECT * FROM companies ORDER BY created_at DESC LIMIT 50');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// FR-B.2: Weighted Forecasting API
app.get('/api/dashboard/stats', authorize(['admin', 'manager']), async (req, res) => {
    try {
        // Calculate total value and weighted value
        // Formula: sum(value) and sum(value * probability / 100)
        const statsQuery = `
      SELECT 
        COUNT(*) as total_deals,
        SUM(value) as total_pipeline_value,
        SUM(value * probability / 100) as expected_revenue
      FROM deals
    `;
        const stageQuery = `
      SELECT stage, COUNT(*) as count, SUM(value) as value
      FROM deals
      GROUP BY stage
    `;

        const [statsResult, stageResult] = await Promise.all([
            pool.query(statsQuery),
            pool.query(stageQuery)
        ]);

        res.json({
            summary: statsResult.rows[0],
            by_stage: stageResult.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// FR-B.1: Kanban Board APIs
app.get('/api/deals', authorize(['admin', 'manager', 'rep', 'intern']), async (req, res) => {
    try {
        let query = `
      SELECT d.*, c.name as company_name, u.email as owner_email
      FROM deals d
      LEFT JOIN companies c ON d.comp_id = c.comp_id
      LEFT JOIN users u ON d.owner_id = u.user_id
    `;
        const params = [];

        // VALIDATION: RBAC Visibility
        if (req.user.role === 'rep' || req.user.role === 'intern') {
            query += ` WHERE d.owner_id = $1`;
            params.push(req.user.id);
        } else if (req.user.role === 'manager') {
            // Manager sees OWN deals AND deals of direct reports
            query += ` WHERE d.owner_id = $1 OR d.owner_id IN (SELECT user_id FROM users WHERE manager_id = $1)`;
            params.push(req.user.id);
        }
        // Admin sees all (no clause)

        query += ` ORDER BY d.updated_at DESC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Manager Analytics API
app.get('/api/analytics/team', authorize(['admin', 'manager']), async (req, res) => {
    try {
        const query = `
            SELECT 
                u.email as rep_name,
                COUNT(d.deal_id) as total_deals,
                SUM(d.value) as total_pipeline,
                SUM(d.value * d.probability / 100) as weighted_forecast,
                COUNT(CASE WHEN d.stage = 'Closed' THEN 1 END) as closed_deals
            FROM users u
            LEFT JOIN deals d ON u.user_id = d.owner_id
            WHERE u.manager_id = $1 OR u.user_id = $1
            GROUP BY u.user_id, u.email
            ORDER BY total_pipeline DESC
        `;
        const result = await pool.query(query, [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// FR-A.3: Deals API
app.post('/api/deals', authorize(['admin', 'manager', 'rep', 'intern']), async (req, res) => {
    const { name, comp_id, value, stage, probability, closing_date, level, offering, priority, frequency, remark } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO deals (name, comp_id, value, stage, probability, closing_date, owner_id, level, offering, priority, frequency, remark) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
            [name, comp_id, value, stage, probability, closing_date, req.user.id, level, offering, priority, frequency, remark]
        );
        const newDeal = result.rows[0];

        // Audit Log
        await req.audit('CREATE', 'DEAL', newDeal.deal_id, null, newDeal);

        res.status(201).json(newDeal);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/deals/:id', authorize(['admin', 'manager', 'rep']), async (req, res) => {
    const { id } = req.params;
    const { stage, remark, priority, frequency, value, probability, closing_date } = req.body;

    // Interns Restriction (Strict Check)
    if (req.user.role === 'intern') {
        return res.status(403).json({ error: 'Interns cannot move or edit deals' });
    }

    try {
        // 1. Fetch current deal to check ownership check (RBAC)
        const currentRes = await pool.query('SELECT * FROM deals WHERE deal_id = $1', [id]);
        if (currentRes.rows.length === 0) return res.status(404).json({ error: 'Deal not found' });

        const currentDeal = currentRes.rows[0];

        // RBAC CHECK
        if (req.user.role === 'rep' && currentDeal.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'You can only edit your own deals' });
        }

        // 2. Dynamic Update Construction
        const fields = [];
        const values = [];
        let idx = 1;

        if (stage !== undefined) { fields.push(`stage = $${idx++}`); values.push(stage); }
        if (remark !== undefined) { fields.push(`remark = $${idx++}`); values.push(remark); }
        if (priority !== undefined) { fields.push(`priority = $${idx++}`); values.push(priority); }
        if (frequency !== undefined) { fields.push(`frequency = $${idx++}`); values.push(frequency); }
        if (value !== undefined) { fields.push(`value = $${idx++}`); values.push(value); }
        if (probability !== undefined) { fields.push(`probability = $${idx++}`); values.push(probability); }
        if (closing_date !== undefined) { fields.push(`closing_date = $${idx++}`); values.push(closing_date); }

        // Allow owner_id update if provided (Manager/Admin only)
        if (req.body.owner_id && (req.user.role === 'admin' || req.user.role === 'manager')) {
            fields.push(`owner_id = $${idx++}`);
            values.push(req.body.owner_id);
        }

        fields.push(`updated_at = NOW()`);

        if (fields.length === 1) { // Only updated_at
            return res.status(400).json({ error: 'No update fields provided' });
        }

        values.push(id);
        const query = `UPDATE deals SET ${fields.join(', ')} WHERE deal_id = $${idx} RETURNING *`;

        const result = await pool.query(query, values);
        const updatedDeal = result.rows[0];

        // 3. Log Activity
        if (stage && stage !== currentDeal.stage) {
            let logContent = `Deal moved to stage: ${stage} by ${req.user.email}`;
            await pool.query(
                `INSERT INTO activities (deal_id, type, content) VALUES ($1, 'NOTE', $2)`,
                [id, logContent]
            );
        }
        if (remark && remark !== currentDeal.remark) {
            await pool.query(
                `INSERT INTO activities (deal_id, type, content) VALUES ($1, 'NOTE', $2)`,
                [id, `Remark updated by ${req.user.email}: ${remark}`]
            );
        }

        // 4. Audit Log
        await req.audit('UPDATE', 'DEAL', id, { ...req.body }, updatedDeal);

        res.json(updatedDeal);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// FR-B.1: Activity Logging API
app.post('/api/activities', authorize(['admin', 'manager', 'rep', 'intern']), async (req, res) => {
    const { deal_id, type, content } = req.body; // type: CALL, EMAIL, NOTE, MEETING
    try {
        const result = await pool.query(
            `INSERT INTO activities (deal_id, type, content) VALUES ($1, $2, $3) RETURNING *`,
            [deal_id, type, content]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});


// -- Start Server --
// Server initialized in startServer()
