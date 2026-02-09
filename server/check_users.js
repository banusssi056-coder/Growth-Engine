
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

async function checkUsers() {
    try {
        const res = await pool.query('SELECT user_id, email, role, created_at FROM users ORDER BY created_at ASC');
        console.log('--- Current Users ---');
        console.table(res.rows);

        // specific check for admin@gmail.com
        const adminUser = res.rows.find(u => u.email === 'admin@gmail.com');
        if (adminUser) {
            if (adminUser.role !== 'admin') {
                console.log('Updating admin@gmail.com to admin role...');
                await pool.query("UPDATE users SET role = 'admin' WHERE email = 'admin@gmail.com'");
                console.log('Updated.');
            } else {
                console.log('admin@gmail.com is already an admin.');
            }
        } else {
            console.log('admin@gmail.com not found. Creating it...');
            await pool.query("INSERT INTO users (email, role, is_active) VALUES ('admin@gmail.com', 'admin', true)");
            console.log('Created admin@gmail.com as admin.');
        }

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkUsers();
