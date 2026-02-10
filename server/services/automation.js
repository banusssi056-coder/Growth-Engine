const { Pool } = require('pg');

// -- FR-C.1: Round-Robin Lead Distribution --
async function assignLeads(pool) {
    try {
        // 1. Find Unassigned Leads (Stage = 'Lead', Owner IS NULL)
        const leadsRes = await pool.query(`
      SELECT deal_id FROM deals 
      WHERE stage = 'Lead' AND owner_id IS NULL 
      ORDER BY created_at ASC 
      LIMIT 50
    `);

        if (leadsRes.rows.length === 0) return; // Nothing to do

        const leads = leadsRes.rows;
        console.log(`[The Brain] Found ${leads.length} unassigned leads.`);

        // 2. Find Available Reps
        // Simple simulated Round Robin: Sort by 'last_assigned_at' ASC (Least recently assigned gets next)
        // NOTE: Requires 'users' table which we will add to schema.sql
        const repsRes = await pool.query(`
      SELECT u.user_id, u.email 
      FROM users u 
      WHERE u.role IN ('rep', 'manager') AND u.is_active = TRUE 
      ORDER BY u.last_assigned_at ASC NULLS FIRST
    `);

        if (repsRes.rows.length === 0) {
            console.warn('[The Brain] No active reps found for assignment.');
            return;
        }

        const reps = repsRes.rows;
        let repIndex = 0;

        // 3. Distribute
        for (const lead of leads) {
            const assignedRep = reps[repIndex];

            await pool.query('BEGIN');

            // Assign Deal
            await pool.query(`
        UPDATE deals 
        SET owner_id = $1, updated_at = NOW() 
        WHERE deal_id = $2
      `, [assignedRep.user_id, lead.deal_id]);

            // Update Rep Timestamp
            await pool.query(`
        UPDATE users 
        SET last_assigned_at = NOW() 
        WHERE user_id = $1
      `, [assignedRep.user_id]);

            // Log Activity (Notification)
            await pool.query(`
        INSERT INTO activities (deal_id, type, content) 
        VALUES ($1, 'NOTE', $2)
      `, [lead.deal_id, `System assigned lead to ${assignedRep.email}`]);

            await pool.query('COMMIT');

            console.log(`[The Brain] Assigned Deal ${lead.deal_id} to ${assignedRep.email}`);

            // Round Robin pointer
            repIndex = (repIndex + 1) % reps.length;
        }

    } catch (err) {
        console.error('[The Brain] Assignment Error:', err);
        await pool.query('ROLLBACK');
    }
}

// -- FR-C.2: Stale Lead Trigger --
async function checkStaleLeads(pool) {
    try {
        const STALE_THRESHOLD_DAYS = 3;

        const staleDeals = await pool.query(`
      SELECT d.deal_id, d.name, u.email as owner_email, u.user_id
      FROM deals d
      LEFT JOIN users u ON d.owner_id = u.user_id
      WHERE d.updated_at < NOW() - INTERVAL '${STALE_THRESHOLD_DAYS} days'
      AND d.stage NOT IN ('Closed', 'Lost')
      AND d.is_stale = FALSE
    `);

        if (staleDeals.rows.length > 0) {
            console.log(`[The Brain] Found ${staleDeals.rows.length} stale deals.`);

            for (const deal of staleDeals.rows) {
                // Flag as Stale
                await pool.query(`
          UPDATE deals SET is_stale = TRUE WHERE deal_id = $1
        `, [deal.deal_id]);

                // Create Alert Activity
                await pool.query(`
          INSERT INTO activities (deal_id, type, content) 
          VALUES ($1, 'CALL', $2)
        `, [deal.deal_id, `[ALERT] Deal is stale (>3 days inactive). Please contact ${deal.name}.`]);
            }
        }
    } catch (err) {
        console.error('[The Brain] Stale Check Error:', err);
    }
}

module.exports = { assignLeads, checkStaleLeads };
