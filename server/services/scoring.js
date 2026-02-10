const { Pool } = require('pg');

// -- FR-D.2: Lead Scoring Algorithm --
async function calculateScore(pool, cont_id) {
    try {
        // 1. Fetch Activities for recent history
        const res = await pool.query(`
      SELECT type, content, occurred_at 
      FROM activities 
      WHERE cont_id = $1
    `, [cont_id]);

        let score = 0;
        let lastActivityDate = null;

        res.rows.forEach(act => {
            // Update last activity
            const actDate = new Date(act.occurred_at);
            if (!lastActivityDate || actDate > lastActivityDate) {
                lastActivityDate = actDate;
            }

            // -- Scoring Rules --
            // +5 points for an email open
            if (act.type === 'SYSTEM' && act.content.includes('Email Opened')) {
                score += 5;
            }
            // +10 points for a link click (Future/Placeholder)
            if (act.type === 'SYSTEM' && act.content.includes('Link Clicked')) {
                score += 10;
            }

            // Base points for generic interaction? SRS doesn't specify, but let's say +1 for any Rep interaction
            if (['CALL', 'MEETING', 'NOTE'].includes(act.type)) {
                score += 2;
            }
        });

        // -- Decay Logic --
        // -20 points for 5 days of silence
        if (lastActivityDate) {
            const daysSince = (new Date() - lastActivityDate) / (1000 * 60 * 60 * 24);
            if (daysSince > 5) {
                score -= 20;
            }
        }

        // Cap score 0-100? SRS says "Calculate a Lead Score (0-100)"
        score = Math.max(0, Math.min(100, score));

        return { score, lastActivityDate };
    } catch (err) {
        console.error('Scoring Error:', err);
        return { score: 0, error: err.message };
    }
}

module.exports = { calculateScore };
