const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');

// GET /api/users - List all users (Admin only)
router.get('/', authorize(['admin', 'manager']), async (req, res) => {
    try {
        const result = await req.db.query(
            'SELECT user_id, email, role, is_active, last_assigned_at, manager_id, created_at FROM users ORDER BY created_at DESC'
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/users/:id - Update user role/status/manager (Admin only)
router.patch('/:id', authorize(['admin']), async (req, res) => {
    const { id } = req.params;
    const { role, is_active, manager_id } = req.body;

    try {
        const query = `
            UPDATE users 
            SET role = COALESCE($1, role), 
                is_active = COALESCE($2, is_active),
                manager_id = COALESCE($3, manager_id)
            WHERE user_id = $4
            RETURNING user_id, email, role, is_active, manager_id
        `;

        const result = await req.db.query(query, [role, is_active, manager_id, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const updatedUser = result.rows[0];

        // Audit Log
        await req.audit('UPDATE', 'USER', id, { role, is_active, manager_id }, updatedUser);

        res.json(updatedUser);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
