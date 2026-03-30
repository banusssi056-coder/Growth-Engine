
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        const tables = ['users', 'deals', 'contacts', 'companies', 'stages'];
        for (const table of tables) {
            const res = await pool.query(`SELECT COUNT(*) FROM ${table}`);
            console.log(`${table}: ${res.rows[0].count}`);
        }
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

check();
