const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function checkDeals() {
    try {
        const res = await pool.query('SELECT deal_id, name, owner_id, stage FROM deals LIMIT 10');
        console.log('Deals sample:', res.rows);

        const countRes = await pool.query('SELECT COUNT(*) FROM deals');
        console.log('Total deals:', countRes.rows[0].count);

        const usersRes = await pool.query('SELECT user_id, email, role FROM users');
        console.log('Users:', usersRes.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkDeals();
