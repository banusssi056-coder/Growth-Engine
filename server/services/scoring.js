/**
 * FR-D.2: Lead Scoring Algorithm
 *
 * Score is stored on deals.lead_score (0-100) and updated:
 *   a) Real-time: whenever an OPEN or CLICK pixel fires (via tracking.js)
 *   b) Batch:     via recalcAllScores() – called by the 12-hour worker (same
 *                 job as staleness checks) to apply the –20 silence penalty
 *
 * Scoring rules (FR-D.2):
 *   +10 per LINK_CLICKED activity
 *   + 5 per EMAIL_OPENED activity
 *   – 20 if latest activity is > 5 days ago
 *   Clamped to [0, 100]
 */

async function calculateScoreForDeal(pool, deal_id) {
    const res = await pool.query(
        `SELECT type, content, occurred_at
         FROM activities
         WHERE deal_id = $1
         ORDER BY occurred_at DESC`,
        [deal_id]
    );

    let score = 0;
    let latestDate = null;

    for (const act of res.rows) {
        const d = new Date(act.occurred_at);
        if (!latestDate || d > latestDate) latestDate = d;

        // Primary typed events (new schema)
        if (act.type === 'EMAIL_OPENED') { score += 5; continue; }
        if (act.type === 'LINK_CLICKED') { score += 10; continue; }

        // Legacy SYSTEM records written before the schema change
        if (act.type === 'SYSTEM') {
            const c = (act.content || '').toLowerCase();
            if (c.includes('email opened')) { score += 5; continue; }
            if (c.includes('link clicked')) { score += 10; continue; }
        }
    }

    // –20 if 5+ days of silence
    if (latestDate) {
        const daysSince = (Date.now() - latestDate.getTime()) / 86_400_000;
        if (daysSince > 5) score -= 20;
    }

    return { score: Math.max(0, Math.min(100, score)), latestDate };
}

/**
 * Batch recalculate scores for ALL non-closed deals.
 * Called from the background worker every 12 hours.
 */
async function recalcAllScores(pool) {
    console.log('[Score] ── Batch Recalc Starting ──');
    try {
        const deals = await pool.query(
            `SELECT deal_id FROM deals WHERE stage NOT IN ('Closed', 'Lost', 'Paid', '8- Paid', '9- Lost')`
        );

        let updated = 0;
        for (const { deal_id } of deals.rows) {
            try {
                const { score } = await calculateScoreForDeal(pool, deal_id);
                await pool.query(
                    `UPDATE deals SET lead_score = $1, score_updated_at = NOW() WHERE deal_id = $2`,
                    [score, deal_id]
                );
                updated++;
            } catch (err) {
                console.error(`[Score] Error for deal ${deal_id}:`, err.message);
            }
        }
        console.log(`[Score] ── Batch Recalc Complete: ${updated}/${deals.rows.length} deals updated ──`);
    } catch (err) {
        console.error('[Score] Batch recalc error:', err);
    }
}

/**
 * Recalculate score for a single deal and persist it.
 * Called on-demand (e.g. from the API endpoint).
 */
async function recalcSingleScore(pool, deal_id) {
    const { score, latestDate } = await calculateScoreForDeal(pool, deal_id);
    await pool.query(
        `UPDATE deals SET lead_score = $1, score_updated_at = NOW() WHERE deal_id = $2`,
        [score, deal_id]
    );
    return { deal_id, score, latestDate };
}

module.exports = { calculateScoreForDeal, recalcAllScores, recalcSingleScore };
