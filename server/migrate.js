require('dotenv').config();
const fs = require('fs');
const path = require('path');
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
        console.log('Reading schema.sql...');
        const schemaPath = path.join(__dirname, '../schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        console.log('Applying Schema to Supabase...');
        await pool.query(schema);
        console.log('✅ Schema Applied Successfully!');
    } catch (err) {
        console.error('❌ Migration Failed:', err);
    } finally {
        await pool.end();
    }
}

migrate();
