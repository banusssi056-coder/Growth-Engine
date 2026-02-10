const { createClient } = require('@supabase/supabase-js');
const dns = require('dns');

// Force IPv4 resolution to avoid IPv6 connection issues
dns.setDefaultResultOrder('ipv4first');

// Support both naming conventions for flexibility
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️ Supabase URL or Anon Key is missing in server environment variables.');
}

// Create Supabase client with custom fetch options to handle connection issues
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: false,
        detectSessionInUrl: false
    },
    global: {
        headers: {
            'x-connection-timeout': '30000'
        }
    }
});

module.exports = supabase;
