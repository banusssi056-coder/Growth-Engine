
require('dotenv').config();
const { Pool } = require('pg');

const rawUrl = process.env.DATABASE_URL || 'postgresql://sssi_user:sssi_password@localhost:5432/sssi_growthengine';
let poolConfig;

// Copy logic from index.js/migrate.js
if (rawUrl.includes('2026Pass@123')) {
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

async function testSyncUser() {
    console.log('Testing Database Connection...');
    try {
        const client = await pool.connect();
        console.log('Connected!');
        client.release();

        const email = `test_${Date.now()}@example.com`;
        const role = 'rep';

        console.log(`Attempting to insert user: ${email}`);

        // Try to insert
        const res = await pool.query(
            `INSERT INTO users (email, role, is_active) 
             VALUES ($1, $2, TRUE) 
             RETURNING *`,
            [email, role]
        );

        console.log('Insert successful:', res.rows[0]);

    } catch (err) {
        console.error('--------------------------------------------------');
        console.error('ERROR:', err);
        console.error('--------------------------------------------------');
    } finally {
        await pool.end();
    }
}

testSyncUser();
