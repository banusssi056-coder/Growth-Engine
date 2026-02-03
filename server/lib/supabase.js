const { createClient } = require('@supabase/supabase-js');

// Support both naming conventions for flexibility
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️ Supabase URL or Anon Key is missing in server environment variables.');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

module.exports = supabase;
