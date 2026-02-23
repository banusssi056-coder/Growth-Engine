/**
 * FR-D.3: Liquid Template Variables
 *
 * Renders outbound email templates with dynamic Liquid variables.
 * Supported context keys:
 *
 *   {{ lead.first_name }}      {{ lead.last_name }}      {{ lead.email }}
 *   {{ lead.company_name }}    {{ lead.full_name }}
 *
 *   {{ deal.name }}            {{ deal.closing_date }}   {{ deal.value }}
 *   {{ deal.stage }}           {{ deal.company_name }}   {{ deal.probability }}
 *
 * After rendering, a 1×1 tracking pixel is injected at the bottom of HTML
 * bodies so email opens are tracked (FR-D.1).
 */

const { Liquid } = require('liquidjs');
const engine = new Liquid();

// Format a value as currency for display in templates
engine.registerFilter('currency', (val) => {
    const num = parseFloat(val);
    if (isNaN(num)) return val;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
});

// Format a date string nicely
engine.registerFilter('date_fmt', (val) => {
    if (!val) return '';
    try {
        return new Date(val).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return val; }
});


/**
 * Build context object from DB for a given deal and/or contact.
 */
async function buildContext(pool, { deal_id, cont_id }) {
    const ctx = { lead: {}, deal: {} };

    if (cont_id) {
        try {
            const res = await pool.query(
                `SELECT c.cont_id, c.first_name, c.last_name, c.email,
                        comp.name AS company_name
                 FROM contacts c
                 LEFT JOIN companies comp ON c.comp_id = comp.comp_id
                 WHERE c.cont_id = $1`,
                [cont_id]
            );
            if (res.rows.length > 0) {
                const r = res.rows[0];
                ctx.lead = {
                    ...r,
                    full_name: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
                };
            }
        } catch { /* table may not exist */ }
    }

    if (deal_id) {
        try {
            const res = await pool.query(
                `SELECT d.deal_id, d.name, d.value, d.stage, d.probability,
                        d.closing_date, d.lead_score,
                        comp.name AS company_name,
                        u.email AS owner_email, u.full_name AS owner_name
                 FROM deals d
                 LEFT JOIN companies comp ON d.comp_id = comp.comp_id
                 LEFT JOIN users u ON d.owner_id = u.user_id
                 WHERE d.deal_id = $1`,
                [deal_id]
            );
            if (res.rows.length > 0) {
                ctx.deal = res.rows[0];
                // Also feed deal's company into lead.company_name if contact didn't have one
                if (!ctx.lead.company_name) ctx.lead.company_name = ctx.deal.company_name;
            }
        } catch { /* table may not exist */ }
    }

    return ctx;
}


/**
 * Render a Liquid template string and optionally inject a tracking pixel.
 *
 * @param {object} pool         - pg Pool
 * @param {string} templateStr  - Liquid template (e.g. "Hello {{ lead.first_name }}")
 * @param {object} opts
 * @param {string} [opts.deal_id]
 * @param {string} [opts.cont_id]
 * @param {string} [opts.send_id]   - if provided, inject pixel for FR-D.1
 * @param {string} [opts.api_base]  - base URL for the pixel (e.g. https://api.sssi.com)
 * @returns {Promise<string>}        - rendered HTML
 */
async function renderTemplate(pool, templateStr, opts = {}) {
    const { deal_id, cont_id, send_id, api_base } = opts;
    const ctx = await buildContext(pool, { deal_id, cont_id });

    let rendered;
    try {
        rendered = await engine.parseAndRender(templateStr, ctx);
    } catch (err) {
        throw new Error(`Template render error: ${err.message}`);
    }

    // FR-D.1: inject tracking pixel at the very end of the HTML body
    if (send_id && api_base) {
        const pixelUrl = `${api_base}/api/track/pixel/${send_id}`;
        const pixel = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;border:0;" />`;
        // Insert before </body> if HTML, else append
        if (/<\/body>/i.test(rendered)) {
            rendered = rendered.replace(/<\/body>/i, `${pixel}</body>`);
        } else {
            rendered += pixel;
        }
    }

    return rendered;
}


/**
 * Preview-only render (no pixel injection, no DB write).
 * Used by the frontend composer's live-preview pane.
 */
async function previewTemplate(pool, templateStr, opts = {}) {
    const ctx = await buildContext(pool, opts);
    try {
        return await engine.parseAndRender(templateStr, ctx);
    } catch (err) {
        throw new Error(`Template preview error: ${err.message}`);
    }
}


/**
 * Return the available template variables for UI hints.
 * The frontend uses this to build the "Insert variable" button menu.
 */
function getAvailableVariables() {
    return [
        // Lead / Contact
        { key: '{{ lead.first_name }}', label: 'Lead – First Name' },
        { key: '{{ lead.last_name }}', label: 'Lead – Last Name' },
        { key: '{{ lead.full_name }}', label: 'Lead – Full Name' },
        { key: '{{ lead.email }}', label: 'Lead – Email' },
        { key: '{{ lead.company_name }}', label: 'Lead – Company' },
        // Deal
        { key: '{{ deal.name }}', label: 'Deal – Name' },
        { key: '{{ deal.value | currency }}', label: 'Deal – Value ($)' },
        { key: '{{ deal.stage }}', label: 'Deal – Stage' },
        { key: '{{ deal.probability }}', label: 'Deal – Probability (%)' },
        { key: '{{ deal.closing_date | date_fmt }}', label: 'Deal – Closing Date' },
        { key: '{{ deal.company_name }}', label: 'Deal – Company' },
        { key: '{{ deal.owner_name }}', label: 'Deal – Owner Name' },
        { key: '{{ deal.owner_email }}', label: 'Deal – Owner Email' },
    ];
}

module.exports = { renderTemplate, previewTemplate, getAvailableVariables, buildContext };
