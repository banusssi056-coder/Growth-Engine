const { Pool } = require('pg');

// Mock Auth Middleware for Dev/Prototype
// In production, this would verify a JWT from an SSO provider (e.g. Auth0, Google)
const supabase = require('../lib/supabase');
const { syncUser } = require('../services/userService');

const authenticate = async (req, res, next) => {
    // Inject pool from app or request if attached, but middleware standard signature doesn't have it easily.
    // We will assume pool is attached to req by a previous middleware or imported. 
    // Actually, let's just require the pool from index or pass it. 
    // Pattern fix: We'll modify authentication to accept pool or attach pool to (req) in index.js.
    // For now, let's assume `req.pool` exists (we will add it in index.js) OR we import it if it was a singleton.
    // Looking at index.js, pool is created there. Best practice: attach pool to req.

    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (!error && user) {
            // Sync with local DB to get Role
            try {
                if (!req.db) throw new Error("Database connection pool missing from request");
                if (!user.email) throw new Error("User email missing from Supabase token");

                const dbUser = await syncUser(req.db, user);

                req.user = {
                    id: dbUser.user_id, // Local DB ID
                    supabase_id: user.id,
                    email: dbUser.email,
                    role: dbUser.role
                };
                return next();
            } catch (err) {
                console.error("Auth Sync Error", err);
                return res.status(500).json({ error: `Auth Error: ${err.message}` });
            }
        }
    }

    // fallback for dev/legacy without token or failed auth
    const mockRole = req.headers['x-mock-role'] || 'admin';
    // ... legacy code ...
    // For safety in production this fallback should eventually be removed or flagged.

    // For now, if no headers and no token, default to Unauthorized if strict.
    // Keeping logic but updating req.user structure to match new schema
    const mockUserId = req.headers['x-mock-user-id'] || '00000000-0000-0000-0000-000000000000';
    req.user = {
        id: mockUserId,
        role: mockRole,
        email: 'dev@sssi.com'
    };
    next();
};

const authorize = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Forbidden' });
        }
        next();
    };
};

module.exports = { authenticate, authorize };
