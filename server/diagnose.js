const dns = require('dns');
const { Pool } = require('pg');
require('dotenv').config();

const host = 'db.ghkviwcymbldnitaqbav.supabase.co';

console.log(`🔍 Resolving DNS for: ${host}`);

dns.resolve4(host, (err, addresses) => {
    if (err) console.error('IPv4 Lookup Failed:', err);
    else console.log('✅ IPv4 Addresses:', addresses);
});

dns.resolve6(host, (err, addresses) => {
    if (err) console.error('IPv6 Lookup Failed/Not Found:', err.message);
    else console.log('⚠️ IPv6 Addresses:', addresses);
});
