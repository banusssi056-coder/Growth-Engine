
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        const user = await pool.query("SELECT * FROM users WHERE email ILIKE 'banusssi056@gmail.com'");
        console.log('User found:', user.rows[0]);
        
        if (user.rows[0]) {
            const userId = user.rows[0].user_id;
            const deals = await pool.query("SELECT COUNT(*) FROM deals WHERE owner_id = $1", [userId]);
            console.log('Deals owned by this user:', deals.rows[0].count);
        }
        
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

main();
