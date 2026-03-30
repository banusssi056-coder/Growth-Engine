
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        console.log('--- Testing Query ---');
        const stats = await pool.query('SELECT COUNT(*) as total_deals, SUM(value) as total_pipeline_value FROM deals');
        console.log('Stats query result:', stats.rows[0]);

        const deals = await pool.query('SELECT name, value FROM deals LIMIT 5');
        console.log('First 5 deals:', deals.rows);
        
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

main();
