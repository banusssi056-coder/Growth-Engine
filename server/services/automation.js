const { Resend } = require('resend');

/**
 * ── FR-C.2: Email Engine (Resend API) ──────────────────────────────────────────
 * 
 * We now use Resend instead of SMTP for reliability and ease of use in 
 * serverless/cloud environments like Cloudflare.
 */
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// ── Send email helper ────────────────────────────────────────────────────────────
async function sendEmail({ to, subject, html }) {
    if (!resend) {
        // No API Key configured — log to console so nothing crashes
        console.log(`[Email] (Resend API Key Missing) TO: ${to} | SUBJECT: ${subject}`);
        console.log(`[Email Content Preview]: ${html.substring(0, 100)}...`);
        return;
    }
    try {
        const { data, error } = await resend.emails.send({
            from: process.env.EMAIL_FROM || 'SSSI GrowthEngine <onboarding@resend.dev>',
            to,
            subject,
            html,
        });

        if (error) {
            console.error('[Email] Resend error:', error.message);
        } else {
            console.log(`[Email] Sent via Resend → ${to}: ${subject} (id: ${data.id})`);
        }
    } catch (err) {
        console.error('[Email] Fatal error:', err.message);
    }
}

// ── Create in-app notification row ───────────────────────────────────────────────
async function createNotification(pool, { userId, type, title, body, dealId }) {
    try {
        await pool.query(
            `INSERT INTO notifications (user_id, type, title, body, deal_id)
             VALUES ($1, $2, $3, $4, $5)`,
            [userId, type, title, body, dealId || null]
        );
    } catch (err) {
        // Gracefully degrade if notifications table doesn't exist yet
        console.warn('[Notification] Insert failed (table may not exist yet):', err.message);
    }
}

// ── FR-C.1: Round-Robin Lead Distribution ────────────────────────────────────────
async function assignLeads(pool) {
    try {
        const leadsRes = await pool.query(`
            SELECT deal_id FROM deals
            WHERE stage = 'Lead' AND owner_id IS NULL
            ORDER BY created_at ASC
            LIMIT 50
        `);

        if (leadsRes.rows.length === 0) return;
        const leads = leadsRes.rows;
        console.log(`[The Brain] Found ${leads.length} unassigned leads.`);

        const repsRes = await pool.query(`
            SELECT user_id, email
            FROM users
            WHERE role IN ('rep', 'manager') AND is_active = TRUE
            ORDER BY last_assigned_at ASC NULLS FIRST
        `);

        if (repsRes.rows.length === 0) {
            console.warn('[The Brain] No active reps found for assignment.');
            return;
        }

        const reps = repsRes.rows;
        let repIndex = 0;

        for (const lead of leads) {
            const assignedRep = reps[repIndex];
            await pool.query('BEGIN');

            await pool.query(
                `UPDATE deals SET owner_id = $1, updated_at = NOW() WHERE deal_id = $2`,
                [assignedRep.user_id, lead.deal_id]
            );
            await pool.query(
                `UPDATE users SET last_assigned_at = NOW() WHERE user_id = $1`,
                [assignedRep.user_id]
            );
            await pool.query(
                `INSERT INTO activities (deal_id, type, content)
                 VALUES ($1, 'NOTE', $2)`,
                [lead.deal_id, `System assigned lead to ${assignedRep.email}`]
            );

            await pool.query('COMMIT');
            console.log(`[The Brain] Assigned Deal ${lead.deal_id} → ${assignedRep.email}`);

            // 4. Notify Rep
            await createNotification(pool, {
                userId: assignedRep.user_id,
                type: 'SYSTEM',
                title: `🆕 New Lead Assigned`,
                body: `You have been assigned a new lead: ${lead.deal_id}. Please follow up.`,
                dealId: lead.deal_id,
            });

            repIndex = (repIndex + 1) % reps.length;
        }
    } catch (err) {
        console.error('[The Brain] Assignment Error:', err);
        try { await pool.query('ROLLBACK'); } catch { /* ignore */ }
    }
}

// ── FR-C.2: Stale Lead Trigger (runs every 12 h) ─────────────────────────────────
//
//  Threshold A  > 3 days  → Omni-channel Alert (Email + In-App) to owner
//  Threshold B  > 48h extra (> 5 days total) → Escalate to Manager
//  Threshold C  > 10 days → Move to "Cold Pool" + unassign owner
//
async function checkStaleLeads(pool) {
    console.log('[The Brain] ── Stale Lead Check Starting ──');
    try {

        // ── Part A: 3-day stale alert ───────────────────────────────────────────
        const staleAlert = await pool.query(`
            SELECT
                d.deal_id, d.name AS deal_name, d.value,
                d.last_activity_date,
                d.cold_pool,
                u.user_id  AS owner_id,
                u.email    AS owner_email,
                u.full_name AS owner_name
            FROM deals d
            LEFT JOIN users u ON d.owner_id = u.user_id
            WHERE
                d.last_activity_date < NOW() - INTERVAL '3 days'
                AND d.stage NOT IN ('Closed', 'Lost', 'Paid')
                AND COALESCE(d.cold_pool, FALSE) = FALSE
                AND d.is_stale = FALSE
                AND d.owner_id IS NOT NULL
        `);

        console.log(`[The Brain] Stale (>3d) deals found: ${staleAlert.rows.length}`);

        for (const deal of staleAlert.rows) {
            const daysSince = Math.floor(
                (Date.now() - new Date(deal.last_activity_date).getTime()) / 86_400_000
            );

            // 1. Mark deal as stale
            await pool.query(
                `UPDATE deals SET is_stale = TRUE, updated_at = NOW() WHERE deal_id = $1`,
                [deal.deal_id]
            );

            // 2. Activity log entry
            await pool.query(
                `INSERT INTO activities (deal_id, type, content)
                 VALUES ($1, 'ALERT', $2)`,
                [
                    deal.deal_id,
                    `[STALE ALERT] Deal inactive for ${daysSince} day(s). Owner: ${deal.owner_email}.`,
                ]
            );

            // 3. In-App Notification
            await createNotification(pool, {
                userId: deal.owner_id,
                type: 'STALE_ALERT',
                title: `⚠️ Stale Deal: ${deal.deal_name}`,
                body: `This deal has had no activity for ${daysSince} day(s). Please follow up immediately.`,
                dealId: deal.deal_id,
            });

            // 4. Email Alert
            await sendEmail({
                to: deal.owner_email,
                subject: `[Action Required] Stale Deal: ${deal.deal_name}`,
                html: `
                    <div style="font-family:sans-serif;max-width:560px;margin:auto">
                        <h2 style="color:#d97706">⚠️ Stale Deal Alert</h2>
                        <p>Hi ${deal.owner_name || deal.owner_email},</p>
                        <p>The deal <strong>${deal.deal_name}</strong> has had
                           <strong>no activity for ${daysSince} day(s)</strong>.</p>
                        <p>Please log a call, email, or note to keep this deal moving.</p>
                        <p style="color:#6b7280;font-size:12px">
                            If no activity is logged within 48 hours, your manager will be notified.
                        </p>
                        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
                        <p style="color:#9ca3af;font-size:11px">SSSI GrowthEngine — Automated Alert</p>
                    </div>
                `,
            });
        }

        // ── Part B: 48h Escalation (> 5 days total) ──────────────────────────────
        const escalation = await pool.query(`
            SELECT
                d.deal_id, d.name AS deal_name, d.value,
                d.last_activity_date,
                u.user_id   AS owner_id,
                u.email     AS owner_email,
                u.full_name AS owner_name,
                m.email     AS manager_email
            FROM deals d
            JOIN users u ON d.owner_id = u.user_id
            LEFT JOIN users m ON u.manager_id = m.user_id
            WHERE
                d.is_stale = TRUE
                AND d.last_activity_date < NOW() - INTERVAL '5 days'
                AND d.escalation_sent_at IS NULL
                AND d.stage NOT IN ('Closed', 'Lost', 'Paid')
                AND COALESCE(d.cold_pool, FALSE) = FALSE
        `);

        console.log(`[The Brain] Escalation (>5d) deals found: ${escalation.rows.length}`);

        for (const deal of escalation.rows) {
            if (!deal.manager_email) continue;

            // 1. Update escalation flag
            await pool.query(
                `UPDATE deals SET escalation_sent_at = NOW() WHERE deal_id = $1`,
                [deal.deal_id]
            );

            // 2. Activity log
            await pool.query(
                `INSERT INTO activities (deal_id, type, content)
                 VALUES ($1, 'ALERT', $2)`,
                [deal.deal_id, `[ESCALATION] Deal inactivity escalated to manager: ${deal.manager_email}`]
            );

            // 3. Email Manager
            await sendEmail({
                to: deal.manager_email,
                subject: `🚨 [ESCALATION] Neglected Deal: ${deal.deal_name}`,
                html: `
                    <div style="font-family:sans-serif;max-width:560px;margin:auto">
                        <h2 style="color:#dc2626">🚨 Deal Escalation</h2>
                        <p>The deal <strong>${deal.deal_name}</strong> owned by <strong>${deal.owner_name || deal.owner_email}</strong>
                           has been neglected for over 5 days.</p>
                        <p>Please review the pipeline and follow up with the representative.</p>
                        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
                        <p style="color:#9ca3af;font-size:11px">SSSI GrowthEngine — Manager Escalation</p>
                    </div>
                `,
            });
        }

        // ── Part C: 10-day Cold Pool ─────────────────────────────────────────────
        const coldPool = await pool.query(`
            SELECT
                d.deal_id, d.name AS deal_name, d.value,
                d.last_activity_date,
                u.user_id  AS owner_id,
                u.email    AS owner_email,
                u.full_name AS owner_name
            FROM deals d
            LEFT JOIN users u ON d.owner_id = u.user_id
            WHERE
                d.last_activity_date < NOW() - INTERVAL '10 days'
                AND d.stage NOT IN ('Closed', 'Lost', 'Paid')
                AND COALESCE(d.cold_pool, FALSE) = FALSE
        `);

        console.log(`[The Brain] Cold Pool (>10d) deals found: ${coldPool.rows.length}`);

        for (const deal of coldPool.rows) {
            const daysSince = Math.floor(
                (Date.now() - new Date(deal.last_activity_date).getTime()) / 86_400_000
            );

            // 1. Move to Cold Pool + unassign owner
            await pool.query(
                `UPDATE deals
                 SET cold_pool  = TRUE,
                     owner_id   = NULL,
                     is_stale   = TRUE,
                     updated_at = NOW()
                 WHERE deal_id = $1`,
                [deal.deal_id]
            );

            // 2. Activity log
            await pool.query(
                `INSERT INTO activities (deal_id, type, content)
                 VALUES ($1, 'SYSTEM', $2)`,
                [
                    deal.deal_id,
                    `[COLD POOL] Deal moved to Cold Pool after ${daysSince} days of inactivity. Owner unassigned.`,
                ]
            );

            // 3. In-App Notification (to previous owner if exists)
            if (deal.owner_id) {
                await createNotification(pool, {
                    userId: deal.owner_id,
                    type: 'COLD_POOL',
                    title: `🧊 Deal Moved to Cold Pool: ${deal.deal_name}`,
                    body: `After ${daysSince} days without activity, this deal has been moved to the Cold Pool and unassigned.`,
                    dealId: deal.deal_id,
                });

                // 4. Email notification
                await sendEmail({
                    to: deal.owner_email,
                    subject: `[Cold Pool] Deal Moved: ${deal.deal_name}`,
                    html: `
                        <div style="font-family:sans-serif;max-width:560px;margin:auto">
                            <h2 style="color:#3b82f6">🧊 Deal Moved to Cold Pool</h2>
                            <p>Hi ${deal.owner_name || deal.owner_email},</p>
                            <p>The deal <strong>${deal.deal_name}</strong> has been
                                moved to the <strong>Cold Pool</strong> after
                                <strong>${daysSince} days</strong> of inactivity.</p>
                            <p>The deal has been <strong>unassigned</strong> from your pipeline.
                                An admin can re-activate and reassign it at any time.</p>
                            <p style="color:#6b7280;font-size:12px">
                                Last Activity: ${new Date(deal.last_activity_date).toDateString()}
                            </p>
                            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
                            <p style="color:#9ca3af;font-size:11px">SSSI GrowthEngine — Automated Alert</p>
                        </div>
                    `,
                });
            }

            console.log(`[The Brain] Cold Pool: Deal ${deal.deal_id} moved after ${daysSince}d inactive.`);
        }

        console.log('[The Brain] ── Stale Lead Check Complete ──');
    } catch (err) {
        console.error('[The Brain] Stale Check Error:', err);
    }
}

// ── FR-C.3: Workflow Rule Engine ─────────────────────────────────────────────────
//
//  Evaluates saved workflow_rules for a given deal.
//  Called whenever a deal is created or updated (from index.js).
//  Returns an array of triggered actions so the caller can apply them.
//
//  Supported trigger_field values: deal_value, probability, stage
//  Supported action_type values  : cc_manager, send_notification, change_stage
//
async function evaluateWorkflowRules(pool, deal) {
    const result = [];
    try {
        const rulesRes = await pool.query(
            `SELECT * FROM workflow_rules WHERE is_active = TRUE`
        );

        for (const rule of rulesRes.rows) {
            const fieldValue = getFieldValue(deal, rule.trigger_field);
            const matches = evaluateCondition(fieldValue, rule.trigger_op, rule.trigger_value);

            if (!matches) continue;

            console.log(`[WorkflowEngine] Rule "${rule.name}" matched for Deal ${deal.deal_id}`);

            // Log: write a notification for the deal owner / admin
            if (deal.owner_id) {
                await createNotification(pool, {
                    userId: deal.owner_id,
                    type: 'WORKFLOW',
                    title: `📋 Workflow Triggered: ${rule.name}`,
                    body: buildActionDescription(rule),
                    dealId: deal.deal_id,
                });
            }

            result.push({
                rule_id: rule.rule_id,
                rule_name: rule.name,
                action_type: rule.action_type,
                action_value: rule.action_value,
            });
        }
    } catch (err) {
        // Gracefully degrade if table doesn't exist yet
        if (err.code !== '42P01') { // 42P01 = table not found
            console.error('[WorkflowEngine] Error:', err.message);
        }
    }
    return result;
}

// ── Helpers for workflow evaluation ──────────────────────────────────────────────
function getFieldValue(deal, field) {
    const map = {
        deal_value: deal.value,
        probability: deal.probability,
        stage: deal.stage,
        is_stale: deal.is_stale,
        cold_pool: deal.cold_pool,
    };
    return map[field] ?? null;
}

function evaluateCondition(fieldValue, op, ruleValue) {
    const numField = parseFloat(fieldValue);
    const numRule = parseFloat(ruleValue);

    switch (op) {
        case 'gt': return numField > numRule;
        case 'gte': return numField >= numRule;
        case 'lt': return numField < numRule;
        case 'lte': return numField <= numRule;
        case 'eq': return String(fieldValue).toLowerCase() === String(ruleValue).toLowerCase();
        case 'neq': return String(fieldValue).toLowerCase() !== String(ruleValue).toLowerCase();
        case 'contains': return String(fieldValue).toLowerCase().includes(String(ruleValue).toLowerCase());
        default: return false;
    }
}

function buildActionDescription(rule) {
    const actions = {
        cc_manager: `Manager CC has been activated for this deal.`,
        send_notification: `A notification has been dispatched: ${rule.action_value}`,
        change_stage: `Stage will be changed to: ${rule.action_value}`,
        assign_to: `Deal will be assigned to user: ${rule.action_value}`,
    };
    return actions[rule.action_type] || `Action: ${rule.action_type} = ${rule.action_value}`;
}

async function checkFollowUps(pool) {
    console.log('[The Brain] Checking for scheduled follow-ups...');
    try {
        const followUps = await pool.query(`
            SELECT 
                d.deal_id, d.name AS deal_name, d.next_follow_up,
                u.user_id AS owner_id, u.email AS owner_email, u.full_name AS owner_name
            FROM deals d
            JOIN users u ON d.owner_id = u.user_id
            WHERE 
                d.next_follow_up <= NOW() 
                AND d.follow_up_notified = FALSE
                AND d.stage NOT IN ('Closed', 'Lost', 'Paid')
        `);

        console.log(`[The Brain] Found ${followUps.rows.length} due follow-ups.`);

        for (const deal of followUps.rows) {
            // 1. Send In-App Notification
            await createNotification(pool, {
                userId: deal.owner_id,
                type: 'FOLLOW_UP',
                title: `📅 Follow-up Reminder: ${deal.deal_name}`,
                body: `It's time for your scheduled follow-up for "${deal.deal_name}".`,
                dealId: deal.deal_id,
            });

            // 2. Send Email
            await sendEmail({
                to: deal.owner_email,
                subject: `📅 Follow-up Reminder: ${deal.deal_name}`,
                html: `
                    <div style="font-family:sans-serif;max-width:560px;margin:auto">
                        <h2 style="color:#10b981">📅 Follow-up Reminder</h2>
                        <p>Hi ${deal.owner_name || deal.owner_email},</p>
                        <p>This is a reminder for your scheduled follow-up for <strong>${deal.deal_name}</strong>.</p>
                        <p>Scheduled for: ${new Date(deal.next_follow_up).toLocaleString()}</p>
                        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
                        <p style="color:#9ca3af;font-size:11px">SSSI GrowthEngine — Automated Follow-up</p>
                    </div>
                `
            });

            // 3. Mark as notified so we don't spam
            await pool.query(
                `UPDATE deals SET follow_up_notified = TRUE WHERE deal_id = $1`,
                [deal.deal_id]
            );

            console.log(`[The Brain] Follow-up notification sent for Deal ${deal.deal_id} to ${deal.owner_email}`);
        }
    } catch (err) {
        console.error('[The Brain] Follow-up Check Error:', err);
    }
}

module.exports = { assignLeads, checkStaleLeads, evaluateWorkflowRules, checkFollowUps };
