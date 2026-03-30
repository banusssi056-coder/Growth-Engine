
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        let query = `
          SELECT d.*, c.name as company_name, u.email as owner_email
          FROM deals d
          LEFT JOIN companies c ON d.comp_id = c.comp_id
          LEFT JOIN users u ON d.owner_id = u.user_id
          ORDER BY d.updated_at DESC
        `;
        const result = await pool.query(query);
        console.log('Number of deals fetched:', result.rows.length);
        if (result.rows.length > 0) {
            console.log('First deal:', result.rows[0]);
        }
        
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

main();
