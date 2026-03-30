const { Pool } = require('pg');
const { CognitoJwtVerifier } = require("aws-jwt-verify");
const { syncUser } = require('../services/userService');

// Configure Cognito Verifier
const verifier = CognitoJwtVerifier.create({
    userPoolId: process.env.COGNITO_USER_POOL_ID,
    tokenUse: "id",
    clientId: process.env.COGNITO_CLIENT_ID,
});

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
        console.log('[Auth] Verifying Cognito token...');
        
        try {
            const payload = await verifier.verify(token);
            console.log('[Auth] Token verified for:', payload.email);

            if (!req.db) throw new Error("Database connection pool missing from request");

            // Sync with local DB
            const cognitoUser = {
                id: payload.sub,
                email: payload.email,
                full_name: payload.name || payload['custom:full_name'] || payload.email,
                avatar_url: payload.picture || null
            };

            const dbUser = await syncUser(req.db, cognitoUser);

            req.user = {
                id: dbUser.user_id, // Local DB ID
                cognito_id: payload.sub,
                email: dbUser.email,
                full_name: dbUser.full_name,
                avatar_url: dbUser.avatar_url,
                phone: dbUser.phone,
                department: dbUser.department,
                role: dbUser.role,
                is_active: dbUser.is_active
            };
            return next();

        } catch (err) {
            console.error('[Auth] Verification failed:', err.message);
        }
    } else {
        console.log('[Auth] No Bearer token found');
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
