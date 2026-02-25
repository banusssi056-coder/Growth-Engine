const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');

// 1×1 transparent GIF
const PIXEL_BUFFER = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64'
);

// ── FR-D.2: Inline score recalculation ────────────────────────────────────
// Called after OPEN and CLICK events to keep the score fresh.
// Full scoring logic lives in services/scoring.js; this is a thin wrapper.
async function recalcScore(db, deal_id) {
    if (!deal_id) return;
    try {
        // Fetch all activities for this deal
        const res = await db.query(
            `SELECT type, occurred_at FROM activities WHERE deal_id = $1 ORDER BY occurred_at DESC`,
            [deal_id]
        );

        let score = 0;
        let latestDate = null;

        for (const act of res.rows) {
            const d = new Date(act.occurred_at);
            if (!latestDate || d > latestDate) latestDate = d;

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

        await db.query(
            `UPDATE deals SET lead_score = $1, score_updated_at = NOW() WHERE deal_id = $2`,
            [score, deal_id]
        );
        console.log(`[Score] Deal ${deal_id} → ${score}`);
    } catch (err) {
        console.error('[Score] Recalc error:', err.message);
    }
}


// ── GET /api/track/pixel/:send_id ───────────────────────────────────────
// Called by the <img> tag embedded in outbound HTML emails.
router.get('/pixel/:send_id', async (req, res) => {
    const { send_id } = req.params;
    const db = req.db;

    // Fire-and-forget: don't let DB errors delay the image response
    ; (async () => {
        try {
            console.log(`[Track] OPEN  → send_id=${send_id}`);

            // 1. Insert tracking event
            await db.query(
                `INSERT INTO tracking_events (send_id, event_type, user_agent, ip_address)
                 VALUES ($1, 'OPEN', $2, $3::inet)`,
                [send_id, req.headers['user-agent'] || null, req.ip || null]
            );

            // 2. Increment open_count + timestamps on email_sends
            await db.query(
                `UPDATE email_sends
                 SET open_count      = open_count + 1,
                     last_opened_at  = NOW(),
                     first_opened_at = COALESCE(first_opened_at, NOW())
                 WHERE send_id = $1`,
                [send_id]
            );

            // 3. Log activity on the associated deal
            const sendRes = await db.query(
                `SELECT deal_id, cont_id FROM email_sends WHERE send_id = $1`,
                [send_id]
            );
            if (sendRes.rows.length > 0) {
                const { deal_id, cont_id } = sendRes.rows[0];
                await db.query(
                    `INSERT INTO activities (deal_id, cont_id, type, content)
                     VALUES ($1, $2, 'EMAIL_OPENED', 'Email Opened (pixel fired)')`,
                    [deal_id, cont_id]
                );
                // Trigger async score recalc
                recalcScore(db, deal_id).catch(() => { });
            }
        } catch (err) {
            console.error('[Track] OPEN log error:', err.message);
        }
    })();

    res.writeHead(200, {
        'Content-Type': 'image/gif',
        'Content-Length': PIXEL_BUFFER.length,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
    });
    res.end(PIXEL_BUFFER);
});

// ── GET /api/track/click/:send_id?url=https://... ───────────────────────
router.get('/click/:send_id', async (req, res) => {
    const { send_id } = req.params;
    const targetUrl = req.query.url || '/';
    const db = req.db;

    ; (async () => {
        try {
            console.log(`[Track] CLICK → send_id=${send_id}, url=${targetUrl}`);

            await db.query(
                `INSERT INTO tracking_events (send_id, event_type, url, user_agent, ip_address)
                 VALUES ($1, 'CLICK', $2, $3, $4::inet)`,
                [send_id, targetUrl, req.headers['user-agent'] || null, req.ip || null]
            );

            await db.query(
                `UPDATE email_sends
                 SET click_count      = click_count + 1,
                     last_clicked_at  = NOW(),
                     first_clicked_at = COALESCE(first_clicked_at, NOW())
                 WHERE send_id = $1`,
                [send_id]
            );

            const sendRes = await db.query(
                `SELECT deal_id, cont_id FROM email_sends WHERE send_id = $1`,
                [send_id]
            );
            if (sendRes.rows.length > 0) {
                const { deal_id, cont_id } = sendRes.rows[0];
                await db.query(
                    `INSERT INTO activities (deal_id, cont_id, type, content)
                     VALUES ($1, $2, 'LINK_CLICKED', $3)`,
                    [deal_id, cont_id, `Link clicked: ${targetUrl}`]
                );
                recalcScore(db, deal_id).catch(() => { });
            }
        } catch (err) {
            console.error('[Track] CLICK log error:', err.message);
        }
    })();

    res.redirect(302, targetUrl);
});

// ── POST /api/track/send (auth required) ────────────────────────────────
router.post('/send', authorize(['admin', 'manager', 'rep', 'intern']), async (req, res) => {
    const { deal_id, cont_id, to_email, subject, body_html, body_raw } = req.body;
    const db = req.db;
    try {
        const result = await db.query(
            `INSERT INTO email_sends (deal_id, cont_id, sent_by, to_email, subject, body_html, body_raw)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING send_id, sent_at`,
            [deal_id, cont_id, req.user.id, to_email, subject, body_html, body_raw]
        );
        const { send_id, sent_at } = result.rows[0];

        await db.query(
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
router.get('/sends/:deal_id', authorize(['admin', 'manager', 'rep', 'intern']), async (req, res) => {
    const db = req.db;
    try {
        const result = await db.query(
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
        if (err.code === '42P01') return res.json([]);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
