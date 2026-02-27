require('dotenv').config();
const cron = require('node-cron');
const { Pool } = require('pg');
const dns = require('dns');

// Force IPv4
dns.setDefaultResultOrder('ipv4first');

const { assignLeads, checkStaleLeads, checkFollowUps } = require('./services/automation');
const { recalcAllScores } = require('./services/scoring'); // FR-D.2

console.log('[The Brain] Starting Automation Worker...');

// -- Database Connection --
const rawUrl = process.env.DATABASE_URL || 'postgresql://sssi_user:sssi_password@localhost:5432/sssi_growthengine';
let poolConfig;

if (rawUrl.includes('supabase.co')) {
    poolConfig = {
        connectionString: rawUrl,
        ssl: { rejectUnauthorized: false }
    };
} else {
    poolConfig = { connectionString: rawUrl, ssl: false };
}

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
    console.error('[Worker] Unexpected DB error:', err);
    process.exit(-1);
});

// Verify connection on startup
pool.connect()
    .then(client => {
        console.log('[Worker] ✅ Connected to database');
        client.release();
    })
    .catch(err => console.error('[Worker] ❌ DB connection failed:', err.message));

// ── Job 1: Round-Robin Lead Assignment & Follow-ups (Every 1 minute) ────────────────
// In production, make this event-driven via Webhooks or Redis Pub/Sub
cron.schedule('* * * * *', async () => {
    await assignLeads(pool);
    await checkFollowUps(pool);
});

// ── Job 2: Stale Lead Check (Every 12 hours) ────────────────────────────────────
// FR-C.2: "Must run a background job every 12 hours"
//   • >3 days inactive  → Omni-channel Alert (Email + In-App)
//   • >10 days inactive → Move to Cold Pool + unassign owner
cron.schedule('0 */12 * * *', async () => {
    console.log('[The Brain] ⏰ 12-hour tick — Running Stale Lead Check + Score Recalc...');
    await checkStaleLeads(pool);
    await recalcAllScores(pool); // FR-D.2: apply silence penalty across all active deals
});

// ── Development helper: run stale check immediately on start ────────────────────
if (process.env.RUN_STALE_ON_START === 'true') {
    console.log('[The Brain] RUN_STALE_ON_START=true — running check now...');
    checkStaleLeads(pool);
}

console.log('[The Brain] Worker is Active. Scheduled Jobs:');
console.log('  • Lead Assignment   → every 30 seconds');
console.log('  • Stale Lead Check  → every 12 hours (FR-C.2)');
console.log('  • Score Recalc      → every 12 hours (FR-D.2)');

// Keep process alive
process.on('SIGINT', () => {
    console.log('[Worker] Shutting down...');
    pool.end();
    process.exit();
});

process.on('SIGTERM', () => {
    console.log('[Worker] SIGTERM received — shutting down...');
    pool.end();
    process.exit();
});
