require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://sssi_user:sssi_password@localhost:5432/sssi_growthengine',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function seed() {
    try {
        console.log('Seeding Database...');

        // 0. Users (Required for Round Robin)
        const userRes = await pool.query(`
          INSERT INTO users (email, role, is_active, last_assigned_at) VALUES
          ('admin@sssi.com', 'admin', true, NOW()),
          ('rep1@sssi.com', 'rep', true, NOW() - INTERVAL '1 hour'),
          ('rep2@sssi.com', 'rep', true, NOW() - INTERVAL '2 hours') -- Should get next lead
          RETURNING user_id;
        `);
        const users = userRes.rows;

        // 1. Companies
        const compRes = await pool.query(`
          INSERT INTO companies (name, domain, industry, revenue) VALUES 
          ('Acme Corp', 'acme.com', 'Manufacturing', 5000000),
          ('Globex', 'globex.com', 'Logistics', 12000000),
          ('Soylent Corp', 'soylent.com', 'Food', 800000)
          RETURNING comp_id;
        `);
        const compIds = compRes.rows.map(r => r.comp_id);

        // 2. Contacts
        await pool.query(`
          INSERT INTO contacts (comp_id, first_name, last_name, email) VALUES 
          ($1, 'Alice', 'Admin', 'alice@acme.com'),
          ($2, 'Bob', 'Builder', 'bob@globex.com')
        `, [compIds[0], compIds[1]]);

        // 3. Deals
        await pool.query(`
          INSERT INTO deals (comp_id, name, value, stage, probability, owner_id, updated_at) VALUES 
          ($1, 'Factory Automation', 150000, 'Proposal', 60, $4, NOW()),
          ($1, 'Maintenance Contract', 20000, 'Meeting', 30, $5, NOW()),
          ($2, 'Global Shipping Deal', 500000, 'Lead', 10, NULL, NOW()), -- Unassigned (Target for Round Robin)
          ($3, 'New Flavor Launch', 75000, 'Closed', 100, $4, NOW()),
          ($2, 'Old Stale Deal', 10000, 'Lead', 10, $5, NOW() - INTERVAL '5 days') -- Stale (Target for Stale Check)
        `, [compIds[0], compIds[1], compIds[2], users[1].user_id, users[2].user_id]);

        console.log('Seeding Complete! (with Users & Stale Data)');
    } catch (err) {
        console.error('Seed Failed', err);
    } finally {
        await pool.end();
    }
}

seed();
