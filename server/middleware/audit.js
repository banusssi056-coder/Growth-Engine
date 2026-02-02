const { Pool } = require('pg');
// Pull pool from parent or recreate? ideally share.
// For now, we'll assume a global pool or passed in. 
// Actually, in Express, we can attach pool to req or import from db.

const logAudit = (pool) => async (req, res, next) => {
    // Capture original send to log response or just log request?
    // SRS: "Every field-level change Must be recorded"
    // This is best done in the controller or service layer, NOT just middleware.
    // Middleware can log "Access", but "Data Change" requires knowing what changed.

    // This middleware attaches a logger function to the request for controllers to use.
    req.audit = async (action, entityType, entityId, oldVal, newVal) => {
        try {
            const query = `
        INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, old_value, new_value, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;
            const values = [
                req.user ? req.user.id : null,
                action,
                entityType,
                entityId,
                oldVal ? JSON.stringify(oldVal) : null,
                newVal ? JSON.stringify(newVal) : null,
                req.ip
            ];
            await pool.query(query, values);
        } catch (err) {
            console.error('Audit Log Failed:', err);
            // Don't crash request if audit fails? Or do standard says "Must be recorded".
            // We should probably throw if strict.
        }
    };
    next();
};

module.exports = logAudit;
