
const { Pool } = require('pg');
require('dotenv').config();

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

async function checkData() {
    try {
        console.log("Checking Deals for Duplicates...");
        const res = await pool.query('SELECT deal_id, name, stage FROM deals');

        const ids = res.rows.map(r => r.deal_id);
        const uniqueIds = new Set(ids);

        if (ids.length !== uniqueIds.size) {
            console.error("❌ CRITICAL: Duplicate Deal IDs found in DB!");
        } else {
            console.log(`✅ ${ids.length} unique deals found.`);
        }

        console.log("\nChecking User Profile API...");
        // Mocking what the server query does
        const userRes = await pool.query("SELECT * FROM users WHERE email = 'admin@gmail.com'");
        if (userRes.rows.length > 0) {
            console.log("✅ Admin user found in DB:", userRes.rows[0]);
        } else {
            console.error("❌ Admin user NOT found in DB");
        }

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkData();
