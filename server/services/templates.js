const { Liquid } = require('liquidjs');
const engine = new Liquid();

// -- FR-D.3: Liquid Template Variables --
async function renderTemplate(pool, templateString, contextId, contextType = 'contact') {
    try {
        let contextData = {};

        if (contextType === 'contact') {
            // Fetch Contact & Company details
            const res = await pool.query(`
        SELECT c.first_name, c.last_name, c.email, comp.name as company_name
        FROM contacts c
        LEFT JOIN companies comp ON c.comp_id = comp.comp_id
        WHERE c.cont_id = $1
      `, [contextId]);

            if (res.rows.length > 0) {
                contextData = { lead: res.rows[0] };
            }
        } else if (contextType === 'deal') {
            // Fetch Deal, Company & Owner details
            const res = await pool.query(`
        SELECT d.name, d.value, d.closing_date, c.name as company_name
        FROM deals d
        LEFT JOIN companies c ON d.comp_id = c.comp_id
        WHERE d.deal_id = $1
      `, [contextId]);

            if (res.rows.length > 0) {
                contextData = { deal: res.rows[0] };
            }
        }

        // Render
        // Example: "Hello {{ lead.first_name }} from {{ lead.company_name }}"
        return await engine.parseAndRender(templateString, contextData);
    } catch (err) {
        console.error('Template Render Error:', err);
        throw err;
    }
}

module.exports = { renderTemplate };
