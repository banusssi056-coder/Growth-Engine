require('dotenv').config();
const { Pool } = require('pg');

const rawUrl = process.env.DATABASE_URL || 'postgresql://sssi_user:sssi_password@localhost:5432/sssi_growthengine';
let poolConfig;

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

async function migrate() {
    try {
        console.log('--- Adding manager_id to users ---');
        await pool.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES users(user_id);
        `);
        console.log('✅ Schema Updated Successfully');
    } catch (err) {
        console.error('Migration Error:', err);
    } finally {
        pool.end();
    }
}

migrate();
