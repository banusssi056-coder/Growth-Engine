const express = require('express');
const router = express.Router();
const path = require('path');

// Transparent 1x1 Pixel (Base64 decoded)
const PIXEL_BUFFER = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

module.exports = (pool) => {
    // GET /api/track/pixel/:act_id
    router.get('/pixel/:act_id', async (req, res) => {
        const { act_id } = req.params;

        // Async Log (don't block the image load)
        (async () => {
            try {
                console.log(`[Tracking] Pixel fired for Activity ${act_id}`);

                // 1. Find the activity to get associated Deal/Contact
                const actRes = await pool.query('SELECT deal_id, cont_id FROM activities WHERE act_id = $1', [act_id]);

                if (actRes.rows.length > 0) {
                    const { deal_id, cont_id } = actRes.rows[0];

                    // 2. Log "OPENED" event
                    // We create a NEW activity to record the exact time of Open
                    await pool.query(`
                INSERT INTO activities (deal_id, cont_id, type, content)
                VALUES ($1, $2, 'SYSTEM', 'Email Opened')
            `, [deal_id, cont_id]);

                    // 3. (Optional) Trigger Scoring Recalc via Event? 
                    // For now, scoring is calculated on-demand via API.
                }

            } catch (err) {
                console.error('[Tracking] Error logging pixel:', err);
            }
        })();

        // Serve Image
        res.writeHead(200, {
            'Content-Type': 'image/gif',
            'Content-Length': PIXEL_BUFFER.length,
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        });
        res.end(PIXEL_BUFFER);
    });

    return router;
};
