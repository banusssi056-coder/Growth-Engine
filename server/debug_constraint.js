const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('supabase.co') ? { rejectUnauthorized: false } : false
});

async function findViolations() {
    try {
        const res = await pool.query('SELECT DISTINCT type FROM activities');
        const types = res.rows.map(r => r.type);
        console.log('Current activity types in DB:', types);

        const validTypes = ['CALL', 'EMAIL', 'NOTE', 'MEETING', 'SYSTEM', 'STAGE_CHANGE', 'ALERT'];
        const invalid = types.filter(t => !validTypes.includes(t));

        if (invalid.length > 0) {
            console.log('Offending types detected:', invalid);
            console.log('Sample rows for offending types:');
            for (const t of invalid) {
                const sample = await pool.query('SELECT act_id, content FROM activities WHERE type = $1 LIMIT 1', [t]);
                console.log(`Type: ${t}, Sample Content: ${sample.rows[0]?.content}`);
            }
        } else {
            console.log('No offending types found against the NEW constraint.');
        }
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

findViolations();
