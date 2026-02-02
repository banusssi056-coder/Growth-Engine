require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Pool } = require('pg');

const { authenticate, authorize } = require('./middleware/auth');
const logAudit = require('./middleware/audit');
const { calculateScore } = require('./services/scoring'); // FR-D.2
const trackingRoutes = require('./routes/tracking');      // FR-D.1
const { renderTemplate } = require('./services/templates'); // FR-D.3

// -- Configuration --
const app = express();
const PORT = process.env.PORT || 5000;

// -- Database Connection --
const rawUrl = process.env.DATABASE_URL || 'postgresql://sssi_user:sssi_password@localhost:5432/sssi_growthengine';
let poolConfig;

// HACK: Specific fix for user's password with '@'
if (rawUrl.includes('2026Pass@123')) {
    console.log('🔧 Using Explicit Config for complex password...');
    poolConfig = {
        user: 'postgres',
        password: '2026Pass@123',
        host: 'db.ghkviwcymbldnitaqbav.supabase.co',
        port: 5432,
        database: 'postgres',
        ssl: { rejectUnauthorized: false }
    };
} else {
    poolConfig = {
        connectionString: rawUrl,
        ssl: rawUrl.includes('supabase.co') ? { rejectUnauthorized: false } : false
    };
}

const pool = new Pool(poolConfig);

// Test Connection Immediately
pool.connect((err, client, release) => {
    if (err) {
        console.error('----------------------------------------');
        console.error('❌ DATABASE CONNECTION FAILED');
        console.error(err.message);
        console.error('----------------------------------------');
    } else {
        console.log('✅ Connected to Database');
        release();
    }
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

// -- Middleware --
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

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

// FR-A.1: Companies API
app.post('/api/companies', authorize(['admin', 'manager', 'rep']), async (req, res) => {
    const { name, domain, industry, revenue } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO companies (name, domain, industry, revenue) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
            [name, domain, industry, revenue]
        );
        const newCompany = result.rows[0];

        // Audit Log
        await req.audit('CREATE', 'COMPANY', newCompany.comp_id, null, newCompany);

        res.status(201).json(newCompany);
    } catch (err) {
        console.error(err);
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
        const result = await pool.query(`
      SELECT d.*, c.name as company_name 
      FROM deals d
      LEFT JOIN companies c ON d.comp_id = c.comp_id
      ORDER BY d.updated_at DESC
    `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/deals/:id', authorize(['admin', 'manager', 'rep']), async (req, res) => {
    const { id } = req.params;
    const { stage } = req.body; // Only allowing stage update for now for drag-and-drop

    if (!stage) return res.status(400).json({ error: 'Stage is required' });

    try {
        // 1. Fetch current deal for Optimistic Locking check (FR-B.3) - omitted for simple drag/drop demo, but good practice.
        // 2. Update Deal
        const result = await pool.query(
            'UPDATE deals SET stage = $1, updated_at = NOW() WHERE deal_id = $2 RETURNING *',
            [stage, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Deal not found' });
        }

        const updatedDeal = result.rows[0];

        // 3. Log Activity (FR-B.1)
        await pool.query(
            `INSERT INTO activities (deal_id, type, content) VALUES ($1, 'NOTE', $2)`,
            [id, `Deal moved to stage: ${stage} by ${req.user.email}`]
        );

        // 4. Audit Log
        await req.audit('UPDATE', 'DEAL', id, { stage: 'Previous' }, updatedDeal);

        res.json(updatedDeal);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});


// -- Start Server --
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
