const { Pool } = require('pg');

// Mock Auth Middleware for Dev/Prototype
// In production, this would verify a JWT from an SSO provider (e.g. Auth0, Google)
const supabase = require('../lib/supabase');

const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (!error && user) {
            req.user = {
                id: user.id,
                email: user.email,
                role: 'admin' // Defaulting to admin for now as roles aren't in Supabase Auth by default
            };
            return next();
        }
    }

    // fallback for dev/legacy without token
    const mockRole = req.headers['x-mock-role'] || 'admin';
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
