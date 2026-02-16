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
        const fields = [];
        const values = [];
        let idx = 1;

        if (role !== undefined) {
            fields.push(`role = $${idx++}`);
            values.push(role);
        }
        if (is_active !== undefined) {
            fields.push(`is_active = $${idx++}`);
            values.push(is_active);
        }
        if (manager_id !== undefined) {
            fields.push(`manager_id = $${idx++}`);
            values.push(manager_id);
        }

        if (fields.length === 0) {
            return res.status(400).json({ error: 'No valid fields provided for update' });
        }

        values.push(id);
        const query = `
            UPDATE users 
            SET ${fields.join(', ')}
            WHERE user_id = $${idx}
            RETURNING user_id, email, role, is_active, manager_id
        `;

        const result = await req.db.query(query, values);

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
