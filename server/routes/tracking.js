/**
 * FR-D.1: Pixel Tracking Engine
 *
 * Routes:
 *   GET  /api/track/pixel/:send_id   → serves 1×1 GIF, logs OPEN event
 *   GET  /api/track/click/:send_id   → logs CLICK event, redirects to ?url=
 *   POST /api/track/send             → records an outbound email send (returns send_id)
 */

const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');

// 1×1 transparent GIF
const PIXEL_BUFFER = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64'
);

module.exports = (pool) => {

    // ── GET /api/track/pixel/:send_id ───────────────────────────────────────
    // Called by the <img> tag embedded in outbound HTML emails.
    // Must respond INSTANTLY with the image; DB work is fully async (fire-and-forget).
    router.get('/pixel/:send_id', async (req, res) => {
        const { send_id } = req.params;

        // Fire-and-forget: don't let DB errors delay the image response
        ; (async () => {
            try {
                console.log(`[Track] OPEN  → send_id=${send_id}`);

                // 1. Insert tracking event
                await pool.query(
                    `INSERT INTO tracking_events (send_id, event_type, user_agent, ip_address)
                     VALUES ($1, 'OPEN', $2, $3::inet)`,
                    [send_id, req.headers['user-agent'] || null, req.ip || null]
                );

                // 2. Increment open_count + timestamps on email_sends
                await pool.query(
                    `UPDATE email_sends
                     SET open_count      = open_count + 1,
                         last_opened_at  = NOW(),
                         first_opened_at = COALESCE(first_opened_at, NOW())
                     WHERE send_id = $1`,
                    [send_id]
                );

                // 3. Log activity on the associated deal for FR-D.2 score recalc
                const sendRes = await pool.query(
                    `SELECT deal_id, cont_id, sent_by FROM email_sends WHERE send_id = $1`,
                    [send_id]
                );
                if (sendRes.rows.length > 0) {
                    const { deal_id, cont_id, sent_by } = sendRes.rows[0];
                    await pool.query(
                        `INSERT INTO activities (deal_id, cont_id, type, content)
                         VALUES ($1, $2, 'EMAIL_OPENED', 'Email Opened (pixel fired)')`,
                        [deal_id, cont_id]
                    );
                    // Trigger async score recalc
                    recalcScore(pool, deal_id).catch(() => { });
                }
            } catch (err) {
                // Graceful degradation: old act_id-based URLs still accepted
                console.error('[Track] OPEN log error:', err.message);
            }
        })();

        // Serve pixel immediately — no waiting
        res.writeHead(200, {
            'Content-Type': 'image/gif',
            'Content-Length': PIXEL_BUFFER.length,
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
        });
        res.end(PIXEL_BUFFER);
    });

    // ── GET /api/track/click/:send_id?url=https://... ───────────────────────
    // Links in outbound emails should point here. We log the click then redirect.
    router.get('/click/:send_id', async (req, res) => {
        const { send_id } = req.params;
        const targetUrl = req.query.url || '/';

        // Fire-and-forget
        ; (async () => {
            try {
                console.log(`[Track] CLICK → send_id=${send_id}, url=${targetUrl}`);

                await pool.query(
                    `INSERT INTO tracking_events (send_id, event_type, url, user_agent, ip_address)
                     VALUES ($1, 'CLICK', $2, $3, $4::inet)`,
                    [send_id, targetUrl, req.headers['user-agent'] || null, req.ip || null]
                );

                await pool.query(
                    `UPDATE email_sends
                     SET click_count      = click_count + 1,
                         last_clicked_at  = NOW(),
                         first_clicked_at = COALESCE(first_clicked_at, NOW())
                     WHERE send_id = $1`,
                    [send_id]
                );

                const sendRes = await pool.query(
                    `SELECT deal_id, cont_id FROM email_sends WHERE send_id = $1`,
                    [send_id]
                );
                if (sendRes.rows.length > 0) {
                    const { deal_id, cont_id } = sendRes.rows[0];
                    await pool.query(
                        `INSERT INTO activities (deal_id, cont_id, type, content)
                         VALUES ($1, $2, 'LINK_CLICKED', $3)`,
                        [deal_id, cont_id, `Link clicked: ${targetUrl}`]
                    );
                    recalcScore(pool, deal_id).catch(() => { });
                }
            } catch (err) {
                console.error('[Track] CLICK log error:', err.message);
            }
        })();

        // Redirect immediately — don't hold the user up
        res.redirect(302, targetUrl);
    });

    // ── POST /api/track/send (auth required) ────────────────────────────────
    // Called by the EmailComposer after sending an email.
    // Records the send and returns the UUID for pixel/link injection.
    router.post('/send', authorize(['admin', 'manager', 'rep']), async (req, res) => {
        const { deal_id, cont_id, to_email, subject, body_html, body_raw } = req.body;
        try {
            const result = await pool.query(
                `INSERT INTO email_sends (deal_id, cont_id, sent_by, to_email, subject, body_html, body_raw)
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING send_id, sent_at`,
                [deal_id, cont_id, req.user.id, to_email, subject, body_html, body_raw]
            );
            const { send_id, sent_at } = result.rows[0];

            // Log activity
            await pool.query(
                `INSERT INTO activities (deal_id, cont_id, type, content)
                 VALUES ($1, $2, 'EMAIL_SENT', $3)`,
                [deal_id, cont_id, `Email sent: "${subject}" → ${to_email}`]
            );

            res.status(201).json({ send_id, sent_at });
        } catch (err) {
            console.error('[Track] SEND log error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ── GET /api/track/sends/:deal_id (auth required) ───────────────────────
    // Returns email send history for a deal (used by EmailComposer)
    router.get('/sends/:deal_id', authorize(['admin', 'manager', 'rep']), async (req, res) => {
        try {
            const result = await pool.query(
                `SELECT es.*, u.email AS sent_by_email
                 FROM email_sends es
                 LEFT JOIN users u ON es.sent_by = u.user_id
                 WHERE es.deal_id = $1
                 ORDER BY es.sent_at DESC
                 LIMIT 20`,
                [req.params.deal_id]
            );
            res.json(result.rows);
        } catch (err) {
            if (err.code === '42P01') return res.json([]); // table not migrated yet
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};


// ── FR-D.2: Inline score recalculation ────────────────────────────────────
// Called after OPEN and CLICK events to keep the score fresh.
// Full scoring logic lives in services/scoring.js; this is a thin wrapper.
async function recalcScore(pool, deal_id) {
    if (!deal_id) return;
    try {
        // Fetch all activities for this deal
        const res = await pool.query(
            `SELECT type, occurred_at FROM activities WHERE deal_id = $1 ORDER BY occurred_at DESC`,
            [deal_id]
        );

        let score = 0;
        let latestDate = null;

        for (const act of res.rows) {
            const d = new Date(act.occurred_at);
            if (!latestDate || d > latestDate) latestDate = d;

            // FR-D.2 scoring rules
            if (act.type === 'EMAIL_OPENED') score += 5;   // +5 for email open
            if (act.type === 'LINK_CLICKED') score += 10;  // +10 for link click
            // Legacy support for old activity records
            if (act.type === 'SYSTEM') {
                const c = (act.content || '').toLowerCase();
                if (c.includes('email opened')) score += 5;
                if (c.includes('link clicked')) score += 10;
            }
        }

        // -20 for 5 days of silence
        if (latestDate) {
            const daysSince = (Date.now() - latestDate.getTime()) / 86_400_000;
            if (daysSince > 5) score -= 20;
        }

        // Clamp 0-100
        score = Math.max(0, Math.min(100, score));

        await pool.query(
            `UPDATE deals SET lead_score = $1, score_updated_at = NOW() WHERE deal_id = $2`,
            [score, deal_id]
        );
        console.log(`[Score] Deal ${deal_id} → ${score}`);
    } catch (err) {
        console.error('[Score] Recalc error:', err.message);
    }
}
