const assert = require('assert');
const { assignLeads, checkStaleLeads } = require('../services/automation');

// -- Mock Database Pool --
class MockPool {
    constructor() {
        this.queries = [];
        this.mockRows = [];
    }

    async query(text, params) {
        this.queries.push({ text, params });
        // Normalize whitespace for easier matching
        const q = text.replace(/\s+/g, ' ').trim();

        // 1. Find Unassigned Leads
        if (q.includes("SELECT deal_id FROM deals WHERE stage = 'Lead' AND owner_id IS NULL")) {
            return { rows: [{ deal_id: 'deal-1' }, { deal_id: 'deal-2' }] };
        }

        // 2. Find Reps
        if (q.includes("SELECT u.user_id, u.email FROM users")) {
            return {
                rows: [
                    { user_id: 'rep-1', email: 'rep1@test.com' },
                    { user_id: 'rep-2', email: 'rep2@test.com' }
                ]
            };
        }

        // 3. Update Deal (Assignment)
        if (q.includes("UPDATE deals SET owner_id")) {
            return { rows: [] };
        }

        // 4. Stale Check
        if (q.includes("SELECT d.deal_id, d.name")) {
            return { rows: [{ deal_id: 'stale-1', name: 'Stale Deal', user_id: 'rep-1' }] };
        }

        return { rows: [] };
    }
}

async function runTests() {
    console.log('Running Automation Tests...');
    const pool = new MockPool();

    // -- Test 1: Round Robin Assignment --
    console.log('Test 1: Round Robin Assignment');
    await assignLeads(pool);

    // Verify Deal 1 assigned to Rep 1
    const update1 = pool.queries.find(q => q.params && q.params[1] === 'deal-1');
    assert.strictEqual(update1.params[0], 'rep-1', 'Deal 1 should be assigned to Rep 1');

    // Verify Deal 2 assigned to Rep 2 (Round Robin)
    const update2 = pool.queries.find(q => q.params && q.params[1] === 'deal-2');
    assert.strictEqual(update2.params[0], 'rep-2', 'Deal 2 should be assigned to Rep 2');

    console.log('PASS: Leads distributed correctly.');

    // -- Test 2: Stale Lead Check --
    pool.queries = []; // Reset
    console.log('Test 2: Stale Lead Detection');
    await checkStaleLeads(pool);

    // Verify Flag Update
    const flagUpdate = pool.queries.find(q => q.text.includes('UPDATE deals SET is_stale = TRUE'));
    assert.ok(flagUpdate, 'Should update is_stale flag');
    assert.strictEqual(flagUpdate.params[0], 'stale-1');

    // Verify Activity Alert
    const alertInsert = pool.queries.find(q => q.text.includes('INSERT INTO activities'));
    assert.ok(alertInsert, 'Should create activity alert');
    assert.ok(alertInsert.params[1].includes('[ALERT]'), 'Content should be an alert');

    console.log('PASS: Stale leads flagged and alerted.');
}

runTests().catch(err => {
    console.error('TEST FAILED:', err);
    process.exit(1);
});
