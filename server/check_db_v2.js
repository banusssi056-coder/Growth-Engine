require('dotenv').config();
const { Pool } = require('pg');
const { URL } = require('url');
const dns = require('dns');

const dbUrl = process.env.DATABASE_URL;

async function testConfig() {
    console.log('--- DB CONNECTION TEST ---');
    if (!dbUrl) {
        console.error('ERROR: DATABASE_URL is missing in .env');
        return;
    }

    try {
        const parsed = new URL(dbUrl);
        console.log(`Original Hostname: ${parsed.hostname}`);

        // Force IPv4 lookup
        try {
            const ip = await dns.promises.lookup(parsed.hostname, { family: 4 });
            console.log(`Resolved IPv4: ${ip.address}`);
            parsed.hostname = ip.address; // Replace host with IP
        } catch (e) {
            console.error('DNS Lookup Failed:', e.message);
        }

        const connStr = parsed.toString();
        // Hide password for log
        const logStr = connStr.replace(/:[^:@]*@/, ':****@');
        console.log(`Connecting to: ${logStr}`);

        const pool = new Pool({
            connectionString: connStr,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 10000
        });

        const client = await pool.connect();
        console.log('✅ SUCCESS: Connected to Database!');
        const res = await client.query('SELECT NOW()');
        console.log('DB Time:', res.rows[0].now);
        client.release();
        await pool.end();
    } catch (err) {
        console.error('❌ FAILURE:', err.message);
        if (err.message.includes('ENETUNREACH')) {
            console.error('Network unreachable - usually IPv6 issue.');
        }
    }
}

testConfig();
