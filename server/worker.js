require('dotenv').config();
const cron = require('node-cron');
const { Pool } = require('pg');
const { assignLeads, checkStaleLeads } = require('./services/automation');

console.log('[The Brain] Starting Automation Worker...');

// -- Database Connection --
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

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

// -- Job 1: Rapid Lead Assignment (Every 30 seconds) --
// In production, this might be event-driven via Webhooks or Redis Pub/Sub
cron.schedule('*/30 * * * * *', async () => {
    // console.log('[The Brain] Running Lead Assignment...');
    await assignLeads(pool);
});

// -- Job 2: Stale Lead Check (Every 12 hours) --
// "Must run a background job every 12 hours" (FR-C.2)
cron.schedule('0 */12 * * *', async () => {
    console.log('[The Brain] Running Stale Lead Check...');
    await checkStaleLeads(pool);
});

console.log('[The Brain] Worker is Active. Jobs Scheduled.');

// Keep process alive
process.on('SIGINT', () => {
    console.log('Shutting down worker...');
    pool.end();
    process.exit();
});
