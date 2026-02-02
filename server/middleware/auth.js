const { Pool } = require('pg');

// Mock Auth Middleware for Dev/Prototype
// In production, this would verify a JWT from an SSO provider (e.g. Auth0, Google)
const authenticate = (req, res, next) => {
    // SIMULATION: Check headers for simulated user
    const mockRole = req.headers['x-mock-role'] || 'admin'; // Default to admin for dev
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
