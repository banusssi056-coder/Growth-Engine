
const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const app = express();

app.get('/api/deals', async (req, res) => {
    try {
        let query = `
          SELECT d.*, c.name as company_name, u.email as owner_email
          FROM deals d
          LEFT JOIN companies c ON d.comp_id = c.comp_id
          LEFT JOIN users u ON d.owner_id = u.user_id
          ORDER BY d.updated_at DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('ERROR IN /api/deals:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/dashboard/stats', async (req, res) => {
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
        console.error('ERROR IN /api/dashboard/stats:', err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(5001, async () => {
    console.log('Test server running on port 5001');
    const { exec } = require('child_process');
    exec('curl http://localhost:5001/api/deals', (err, stdout, stderr) => {
        console.log('DEALS LENGTH:', JSON.parse(stdout).length);
        exec('curl http://localhost:5001/api/dashboard/stats', (err, stdout2) => {
             console.log('STATS RESPONSE:', JSON.parse(stdout2));
             process.exit(0);
        });
    });
});
