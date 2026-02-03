const { Pool } = require('pg');

const syncUser = async (pool, supabaseUser) => {
    const { email } = supabaseUser;

    // DEBUG LOG
    console.log(`[SyncUser] Starting sync for: ${email}`);

    try {
        // 1. Check if user exists
        const res = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        if (res.rows.length > 0) {
            // User exists, return full record
            console.log(`[SyncUser] Found existing user: ${email} (${res.rows[0].role})`);
            return res.rows[0];
        }

        // 2. User doesn't exist - Determine Role
        console.log(`[SyncUser] User not found. Checking if first user...`);

        const countRes = await pool.query('SELECT COUNT(*) FROM users');
        const count = parseInt(countRes.rows[0].count);
        const isFirstUser = count === 0;

        const role = isFirstUser ? 'admin' : 'rep';
        console.log(`[SyncUser] User Count: ${count}. Assigning Role: ${role}`);

        // 3. Insert new user
        const insertRes = await pool.query(
            `INSERT INTO users (email, role, is_active) 
             VALUES ($1, $2, TRUE) 
             RETURNING *`,
            [email, role]
        );

        console.log(`✅ [SyncUser] Created new user: ${email} as ${role}`);
        return insertRes.rows[0];

    } catch (err) {
        console.error('[SyncUser] Error syncing user:', err);
        throw err;
    }
};

module.exports = { syncUser };
