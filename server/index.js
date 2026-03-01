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
const { recalcSingleScore } = require('./services/scoring');       // FR-D.2
const trackingRoutes = require('./routes/tracking');                // FR-D.1
const userRoutes = require('./routes/users');                       // Admin User Mgmt
const { renderTemplate, previewTemplate, getAvailableVariables } = require('./services/templates'); // FR-D.3
const { evaluateWorkflowRules } = require('./services/automation'); // FR-C.3

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

// FR-D.3: Template Preview API (live preview — no pixel injection)
app.post('/api/templates/preview', authorize(['admin', 'manager', 'rep', 'intern']), async (req, res) => {
    const { template, deal_id, cont_id } = req.body;
    try {
        const rendered = await previewTemplate(pool, template, { deal_id, cont_id });
        res.json({ rendered });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// FR-D.3: Return list of available Liquid variables for the composer UI
app.get('/api/templates/variables', authorize(['admin', 'manager', 'rep', 'intern']), (_req, res) => {
    res.json(getAvailableVariables());
});

// FR-D.2: On-demand lead score recalculation for a single deal
app.post('/api/deals/:id/score', authorize(['admin', 'manager', 'rep', 'intern']), async (req, res) => {
    try {
        const result = await recalcSingleScore(pool, req.params.id);
        res.json(result);
    } catch (err) {
        console.error('[Score] API error:', err);
        res.status(500).json({ error: err.message });
    }
});

// FR-D.2: Read current score for a deal (lightweight GET)
app.get('/api/deals/:id/score', authorize(['admin', 'manager', 'rep', 'intern']), async (req, res) => {
    try {
        const r = await pool.query(
            `SELECT lead_score, score_updated_at FROM deals WHERE deal_id = $1`,
            [req.params.id]
        );
        if (r.rows.length === 0) return res.status(404).json({ error: 'Deal not found' });
        res.json(r.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// -- Routes --
app.use('/api/track', trackingRoutes); // Mount Pixel Tracking at /api/track/pixel/:id
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
        if (req.user.role === 'rep') {
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

// ══════════════════════════════════════════════════════════════════════════════
// FR-B.1: Customizable Stages API
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/stages — returns all active stages ordered by position
app.get('/api/stages', authorize(['admin', 'manager', 'rep', 'intern']), async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM stages WHERE is_active = TRUE ORDER BY position ASC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error('[Stages] GET error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/stages — admin creates a new stage
app.post('/api/stages', authorize(['admin']), async (req, res) => {
    const { name, color, probability } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Stage name is required' });
    try {
        // Place at end
        const posRes = await pool.query(`SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM stages`);
        const position = posRes.rows[0].next_pos;

        const result = await pool.query(
            `INSERT INTO stages (name, color, position, probability)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [name.trim(), color || '#94a3b8', position, probability ?? 10]
        );
        await req.audit('CREATE', 'STAGE', result.rows[0].stage_id, null, result.rows[0]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: 'A stage with that name already exists' });
        console.error('[Stages] POST error:', err);
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/stages/:id — admin renames, recolors, or reorders a stage
app.patch('/api/stages/:id', authorize(['admin']), async (req, res) => {
    const { id } = req.params;
    const { name, color, position, probability, is_active } = req.body;
    try {
        const oldRes = await pool.query(`SELECT * FROM stages WHERE stage_id = $1`, [id]);
        if (oldRes.rows.length === 0) return res.status(404).json({ error: 'Stage not found' });

        const fields = [];
        const values = [];
        let idx = 1;
        if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
        if (color !== undefined) { fields.push(`color = $${idx++}`); values.push(color); }
        if (position !== undefined) { fields.push(`position = $${idx++}`); values.push(position); }
        if (probability !== undefined) { fields.push(`probability = $${idx++}`); values.push(probability); }
        if (is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(is_active); }
        fields.push(`updated_at = NOW()`);

        values.push(id);
        const result = await pool.query(
            `UPDATE stages SET ${fields.join(', ')} WHERE stage_id = $${idx} RETURNING *`,
            values
        );
        await req.audit('UPDATE', 'STAGE', id, oldRes.rows[0], result.rows[0]);
        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: 'A stage with that name already exists' });
        console.error('[Stages] PATCH error:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/stages/:id — soft-delete (set is_active = false)
app.delete('/api/stages/:id', authorize(['admin']), async (req, res) => {
    const { id } = req.params;
    try {
        // Prevent deleting a stage that still has deals
        const dealsCheck = await pool.query(
            `SELECT COUNT(*) FROM deals d
             JOIN stages s ON d.stage = s.name
             WHERE s.stage_id = $1`, [id]
        );
        if (parseInt(dealsCheck.rows[0].count) > 0) {
            return res.status(409).json({ error: 'Cannot delete a stage that contains active deals. Move them first.' });
        }
        await pool.query(`UPDATE stages SET is_active = FALSE, updated_at = NOW() WHERE stage_id = $1`, [id]);
        await req.audit('DELETE', 'STAGE', id, null, null);
        res.json({ success: true });
    } catch (err) {
        console.error('[Stages] DELETE error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/deals/:id/activities — returns activity log for the deal
app.get('/api/deals/:id/activities', authorize(['admin', 'manager', 'rep', 'intern']), async (req, res) => {
    const { id } = req.params;
    try {
        // RBAC Check
        if (req.user.role === 'rep') {
            const ownershipRes = await pool.query('SELECT owner_id FROM deals WHERE deal_id = $1', [id]);
            if (ownershipRes.rows.length === 0) return res.status(404).json({ error: 'Deal not found' });
            if (ownershipRes.rows[0].owner_id !== req.user.id) {
                return res.status(403).json({ error: 'You can only view activities for your own deals' });
            }
        } else if (req.user.role === 'manager') {
            const ownershipRes = await pool.query(
                `SELECT d.owner_id FROM deals d 
                 WHERE d.deal_id = $1 AND (d.owner_id = $2 OR d.owner_id IN (SELECT user_id FROM users WHERE manager_id = $2))`,
                [id, req.user.id]
            );
            if (ownershipRes.rows.length === 0) {
                return res.status(403).json({ error: 'You can only view activities for deals in your team' });
            }
        }

        const result = await pool.query(
            `SELECT a.*, u.full_name AS actor_name
             FROM   activities a
             LEFT JOIN users u ON a.actor_id = u.user_id
             WHERE  a.deal_id = $1
             ORDER  BY a.occurred_at DESC
             LIMIT  50`,
            [id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('[Activities] GET error:', err);
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
app.post('/api/companies', authorize(['admin', 'manager', 'rep', 'intern']), async (req, res) => {
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
app.get('/api/dashboard/stats', authorize(['admin', 'manager', 'rep', 'intern']), async (req, res) => {
    try {
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

// GET /api/users/team — returns direct reports for the current manager
app.get('/api/users/team', authorize(['admin', 'manager']), async (req, res) => {
    try {
        let query = 'SELECT user_id, email, full_name, role FROM users WHERE is_active = TRUE';
        const params = [];

        if (req.user.role === 'manager') {
            // Managers see themselves + their direct reports
            query += ' AND (manager_id = $1 OR user_id = $1)';
            params.push(req.user.id);
        }
        // Admin sees everyone (default query)

        query += ' ORDER BY full_name ASC';
        const result = await pool.query(query, params);
        res.json(result.rows);
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
        query += ` ORDER BY d.updated_at DESC`;

        const result = await pool.query(query);
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

// FR-A.3 & 6.1: Lead Ingestion & Deals API
app.post('/api/deals', authorize(['admin', 'manager', 'rep', 'intern']), async (req, res) => {
    const {
        name, comp_id, value, stage, probability, closing_date,
        level, offering, priority, frequency, remark,
        email, first_name, last_name, owner_id, next_follow_up // Email info for Lead Ingestion flow
    } = req.body;

    try {
        let final_comp_id = comp_id;
        let final_cont_id = null;

        // 6.1.2: System checks for Duplicate Email
        if (email) {
            const contactRes = await pool.query('SELECT cont_id, comp_id FROM contacts WHERE email = $1', [email]);
            if (contactRes.rows.length > 0) {
                final_cont_id = contactRes.rows[0].cont_id;
                final_comp_id = final_comp_id || contactRes.rows[0].comp_id;

                // Check for active deals for this contact (Deduplication)
                const activeDeals = await pool.query(
                    `SELECT deal_id FROM deals 
                     WHERE (owner_id IS NOT NULL OR stage = 'Lead') 
                     AND stage NOT IN ('Closed', 'Lost', 'Paid')
                     AND EXISTS (SELECT 1 FROM activities a WHERE a.deal_id = deals.deal_id AND a.cont_id = $1)
                     LIMIT 1`,
                    [final_cont_id]
                );
                if (activeDeals.rows.length > 0) {
                    return res.status(409).json({
                        error: 'Duplicate Lead: This contact already has an active deal.',
                        deal_id: activeDeals.rows[0].deal_id
                    });
                }
            } else if (first_name && last_name) {
                // Create contact if unique
                const newContact = await pool.query(
                    `INSERT INTO contacts (first_name, last_name, email, comp_id) 
                     VALUES ($1, $2, $3, $4) RETURNING cont_id`,
                    [first_name, last_name, email, final_comp_id]
                );
                final_cont_id = newContact.rows[0].cont_id;
            }
        }

        // 6.1.3 & 6.1.5: Assignment & Lead Score
        // RBAC: Reps MUST be the owner of leads they create manually
        let finalOwnerId = owner_id;
        if (req.user.role === 'rep') {
            finalOwnerId = req.user.id;
        } else if (!finalOwnerId) {
            // Managers/Admins can create unassigned leads
            finalOwnerId = (stage === 'Lead' ? null : req.user.id);
        }

        const initialScore = 10;
        const result = await pool.query(
            `INSERT INTO deals (
                name, comp_id, value, stage, probability, closing_date, 
                owner_id, level, offering, priority, frequency, remark, 
                last_activity_date, lead_score, next_follow_up
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), $13, $14) RETURNING *`,
            [
                name, final_comp_id, value || 0, stage || 'Lead', probability || 10, closing_date,
                finalOwnerId, level, offering, priority, frequency, remark, initialScore, next_follow_up
            ]
        );
        const newDeal = result.rows[0];

        // Link contact to deal in activities (as an initialization note)
        if (final_cont_id) {
            await pool.query(
                `INSERT INTO activities (deal_id, cont_id, type, content) 
                 VALUES ($1, $2, 'SYSTEM', 'Lead ingested via API/Manual Entry')`,
                [newDeal.deal_id, final_cont_id]
            );
        }

        // Audit Log
        await req.audit('CREATE', 'DEAL', newDeal.deal_id, null, newDeal);

        // FR-C.3: Evaluate workflow rules on new deal
        const triggeredRules = await evaluateWorkflowRules(pool, newDeal);
        const ccManager = triggeredRules.some(r => r.action_type === 'cc_manager');

        res.status(201).json({ ...newDeal, cc_manager: ccManager, triggered_rules: triggeredRules });
    } catch (err) {
        console.error('[DealIngestion] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/deals/:id', authorize(['admin', 'manager', 'rep']), async (req, res) => {
    const { id } = req.params;
    const { stage, remark, priority, frequency, value, probability, closing_date, next_follow_up } = req.body;

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

        if (req.user.role === 'manager') {
            // Check if deal belongs to manager or their reports
            const ownershipRes = await pool.query(
                `SELECT 1 FROM users WHERE user_id = $1 AND (user_id = $2 OR manager_id = $2)`,
                [currentDeal.owner_id, req.user.id]
            );
            if (ownershipRes.rows.length === 0 && currentDeal.owner_id !== null) {
                return res.status(403).json({ error: 'You can only edit deals belonging to your team' });
            }
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
        if (next_follow_up !== undefined) {
            fields.push(`next_follow_up = $${idx++}`);
            values.push(next_follow_up);
            // Reset notified flag if follow up date changes
            fields.push(`follow_up_notified = FALSE`);
        }

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

        // 3. Log Activity (rich STAGE_CHANGE entry with actor info)
        if (stage && stage !== currentDeal.stage) {
            await pool.query(
                `INSERT INTO activities (deal_id, type, content, actor_id, actor_email)
                 VALUES ($1, 'STAGE_CHANGE', $2, $3, $4)`,
                [
                    id,
                    `Stage changed from "${currentDeal.stage}" → "${stage}"`,
                    req.user.id,
                    req.user.email
                ]
            );
            // Also write to audit_logs for immutable trail
            await req.audit('STAGE_CHANGE', 'DEAL', id,
                { stage: currentDeal.stage },
                { stage }
            );
        }

        // Log Owner Change
        if (req.body.owner_id && req.body.owner_id !== currentDeal.owner_id) {
            await pool.query(
                `INSERT INTO activities (deal_id, type, content, actor_id, actor_email)
                 VALUES ($1, 'SYSTEM', $2, $3, $4)`,
                [
                    id,
                    `Deal reassigned by ${req.user.email}`,
                    req.user.id,
                    req.user.email
                ]
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

        // 5. FR-C.3: Re-evaluate workflow rules after update
        const triggeredRules = await evaluateWorkflowRules(pool, updatedDeal);
        const ccManager = triggeredRules.some(r => r.action_type === 'cc_manager');

        res.json({ ...updatedDeal, cc_manager: ccManager, triggered_rules: triggeredRules });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// FR-B.1: Activity Logging API
app.post('/api/activities', authorize(['admin', 'manager', 'rep', 'intern']), async (req, res) => {
    const { deal_id, type, content } = req.body;
    try {
        // RBAC: Reps can only log activities for their own deals
        if (req.user.role === 'rep') {
            const ownershipRes = await pool.query('SELECT owner_id FROM deals WHERE deal_id = $1', [deal_id]);
            if (ownershipRes.rows.length === 0) return res.status(404).json({ error: 'Deal not found' });
            if (ownershipRes.rows[0].owner_id !== req.user.id) {
                return res.status(403).json({ error: 'You can only log activities for your own deals' });
            }
        }

        const result = await pool.query(
            `INSERT INTO activities (deal_id, type, content, actor_id) VALUES ($1, $2, $3, $4) RETURNING *`,
            [deal_id, type, content, req.user.id]
        );
        // The DB trigger trg_update_last_activity will auto-update deals.last_activity_date
        // and mark deal as no longer stale when activity is added
        await pool.query(
            `UPDATE deals SET is_stale = FALSE, updated_at = NOW() WHERE deal_id = $1`,
            [deal_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// FR-C.2: In-App Notifications API
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/notifications — returns unread notifications for current user
app.get('/api/notifications', authorize(['admin', 'manager', 'rep', 'intern']), async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT n.*, d.name AS deal_name
             FROM notifications n
             LEFT JOIN deals d ON n.deal_id = d.deal_id
             WHERE n.user_id = $1
             ORDER BY n.created_at DESC
             LIMIT 50`,
            [req.user.id]
        );
        const unread_count = result.rows.filter(n => !n.is_read).length;
        res.json({ notifications: result.rows, unread_count });
    } catch (err) {
        if (err.code === '42P01') return res.json({ notifications: [], unread_count: 0 }); // Table not yet migrated
        console.error('[Notifications] GET error:', err);
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/notifications/:id/read — mark a notification as read
app.patch('/api/notifications/:id/read', authorize(['admin', 'manager', 'rep', 'intern']), async (req, res) => {
    try {
        await pool.query(
            `UPDATE notifications SET is_read = TRUE WHERE notif_id = $1 AND user_id = $2`,
            [req.params.id, req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[Notifications] PATCH error:', err);
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/notifications/read-all — mark all as read
app.patch('/api/notifications/read-all', authorize(['admin', 'manager', 'rep', 'intern']), async (req, res) => {
    try {
        await pool.query(
            `UPDATE notifications SET is_read = TRUE WHERE user_id = $1`,
            [req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[Notifications] PATCH-ALL error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// FR-C.3: Workflow Rules CRUD API (Admin only)
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/workflow-rules
app.get('/api/workflow-rules', authorize(['admin']), async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT wr.*, u.email AS created_by_email
             FROM workflow_rules wr
             LEFT JOIN users u ON wr.created_by = u.user_id
             ORDER BY wr.created_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        if (err.code === '42P01') return res.json([]);
        console.error('[WorkflowRules] GET error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/workflow-rules
app.post('/api/workflow-rules', authorize(['admin']), async (req, res) => {
    const { name, trigger_field, trigger_op, trigger_value, action_type, action_value, is_active } = req.body;
    if (!name || !trigger_field || !trigger_op || trigger_value === undefined || !action_type) {
        return res.status(400).json({ error: 'name, trigger_field, trigger_op, trigger_value, and action_type are required' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO workflow_rules (name, trigger_field, trigger_op, trigger_value, action_type, action_value, is_active, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [name, trigger_field, trigger_op, String(trigger_value), action_type, action_value || null, is_active !== false, req.user.id]
        );
        await req.audit('CREATE', 'WORKFLOW_RULE', result.rows[0].rule_id, null, result.rows[0]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('[WorkflowRules] POST error:', err);
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/workflow-rules/:id
app.patch('/api/workflow-rules/:id', authorize(['admin']), async (req, res) => {
    const { id } = req.params;
    const { name, trigger_field, trigger_op, trigger_value, action_type, action_value, is_active } = req.body;
    try {
        const oldRes = await pool.query(`SELECT * FROM workflow_rules WHERE rule_id = $1`, [id]);
        if (oldRes.rows.length === 0) return res.status(404).json({ error: 'Rule not found' });

        const fields = []; const values = []; let idx = 1;
        if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
        if (trigger_field !== undefined) { fields.push(`trigger_field = $${idx++}`); values.push(trigger_field); }
        if (trigger_op !== undefined) { fields.push(`trigger_op = $${idx++}`); values.push(trigger_op); }
        if (trigger_value !== undefined) { fields.push(`trigger_value = $${idx++}`); values.push(String(trigger_value)); }
        if (action_type !== undefined) { fields.push(`action_type = $${idx++}`); values.push(action_type); }
        if (action_value !== undefined) { fields.push(`action_value = $${idx++}`); values.push(action_value); }
        if (is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(is_active); }
        fields.push(`updated_at = NOW()`);
        values.push(id);

        const result = await pool.query(
            `UPDATE workflow_rules SET ${fields.join(', ')} WHERE rule_id = $${idx} RETURNING *`,
            values
        );
        await req.audit('UPDATE', 'WORKFLOW_RULE', id, oldRes.rows[0], result.rows[0]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('[WorkflowRules] PATCH error:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/workflow-rules/:id
app.delete('/api/workflow-rules/:id', authorize(['admin']), async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query(`DELETE FROM workflow_rules WHERE rule_id = $1`, [id]);
        await req.audit('DELETE', 'WORKFLOW_RULE', id, null, null);
        res.json({ success: true });
    } catch (err) {
        console.error('[WorkflowRules] DELETE error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ── FR-C.3: Test / Dry-Run a workflow rule against current deals ──────────────
// POST /api/workflow-rules/test  { trigger_field, trigger_op, trigger_value }
app.post('/api/workflow-rules/test', authorize(['admin']), async (req, res) => {
    const { trigger_field, trigger_op, trigger_value } = req.body;
    try {
        const deals = await pool.query(`SELECT deal_id, name, value, stage, probability FROM deals LIMIT 200`);
        const { evaluateWorkflowRules: _, ...rest } = require('./services/automation');
        // Inline evaluation for dry-run
        const { evaluateCondition, getFieldValue } = (() => {
            const getFieldValue = (deal, field) => ({ deal_value: deal.value, probability: deal.probability, stage: deal.stage })[field] ?? null;
            const evaluateCondition = (fv, op, rv) => {
                const nf = parseFloat(fv), nr = parseFloat(rv);
                switch (op) {
                    case 'gt': return nf > nr;
                    case 'gte': return nf >= nr;
                    case 'lt': return nf < nr;
                    case 'lte': return nf <= nr;
                    case 'eq': return String(fv).toLowerCase() === String(rv).toLowerCase();
                    case 'neq': return String(fv).toLowerCase() !== String(rv).toLowerCase();
                    case 'contains': return String(fv).toLowerCase().includes(String(rv).toLowerCase());
                    default: return false;
                }
            };
            return { getFieldValue, evaluateCondition };
        })();

        const matched = deals.rows.filter(d =>
            evaluateCondition(getFieldValue(d, trigger_field), trigger_op, trigger_value)
        );
        res.json({ matched_count: matched.length, total_deals: deals.rows.length, matched_deals: matched.slice(0, 10) });
    } catch (err) {
        console.error('[WorkflowRules] Test error:', err);
        res.status(500).json({ error: err.message });
    }
});


// -- Start Server --
// Server initialized in startServer()
