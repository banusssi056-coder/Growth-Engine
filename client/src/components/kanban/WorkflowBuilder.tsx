'use client';
/**
 * FR-C.3 — Visual Workflow Builder
 *
 * Admins can define IF/THEN rules based on deal fields.
 * Example: IF Deal_Value > 50000 THEN CC_Manager = TRUE
 *
 * Features:
 *  • List all existing rules with live toggle (active/inactive)
 *  • Create new rule via an intuitive form builder
 *  • Delete rules
 *  • Dry-run test to see how many existing deals would match
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
    Plus, Trash2, Zap, CheckCircle2, XCircle,
    Loader2, FlaskConical, ChevronDown, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Configuration Options ─────────────────────────────────────────────────────
const TRIGGER_FIELDS = [
    { value: 'deal_value', label: 'Deal Value ($)' },
    { value: 'probability', label: 'Probability (%)' },
    { value: 'stage', label: 'Stage (text)' },
];

const TRIGGER_OPS: Record<string, { value: string; label: string }[]> = {
    deal_value: [
        { value: 'gt', label: '>' },
        { value: 'gte', label: '>=' },
        { value: 'lt', label: '<' },
        { value: 'lte', label: '<=' },
        { value: 'eq', label: '=' },
    ],
    probability: [
        { value: 'gt', label: '>' },
        { value: 'gte', label: '>=' },
        { value: 'lt', label: '<' },
        { value: 'lte', label: '<=' },
        { value: 'eq', label: '=' },
    ],
    stage: [
        { value: 'eq', label: 'is exactly' },
        { value: 'neq', label: 'is not' },
        { value: 'contains', label: 'contains' },
    ],
};

const ACTION_TYPES = [
    { value: 'cc_manager', label: 'CC Manager on all comms' },
    { value: 'send_notification', label: 'Send Notification to Owner' },
    { value: 'change_stage', label: 'Change Stage to…' },
    { value: 'assign_to', label: 'Assign Deal to User' },
];

const OP_LABEL: Record<string, string> = {
    gt: '>', gte: '>=', lt: '<', lte: '<=', eq: '=', neq: '≠', contains: 'contains',
};

const ACTION_LABEL: Record<string, string> = {
    cc_manager: 'CC Manager',
    send_notification: 'Notify Owner',
    change_stage: 'Change Stage',
    assign_to: 'Assign To',
};

// ─── Types ─────────────────────────────────────────────────────────────────────
interface WorkflowRule {
    rule_id: string;
    name: string;
    is_active: boolean;
    trigger_field: string;
    trigger_op: string;
    trigger_value: string;
    action_type: string;
    action_value: string | null;
    created_by_email?: string;
    created_at: string;
}

interface FormState {
    name: string;
    trigger_field: string;
    trigger_op: string;
    trigger_value: string;
    action_type: string;
    action_value: string;
}

const BLANK_FORM: FormState = {
    name: '',
    trigger_field: 'deal_value',
    trigger_op: 'gt',
    trigger_value: '50000',
    action_type: 'cc_manager',
    action_value: '',
};

// ─── Main Component ────────────────────────────────────────────────────────────
export function WorkflowBuilder() {
    const [rules, setRules] = useState<WorkflowRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<FormState>(BLANK_FORM);
    const [testResult, setTestResult] = useState<{ matched_count: number; total_deals: number; matched_deals: any[] } | null>(null);
    const [testing, setTesting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedRule, setExpandedRule] = useState<string | null>(null);

    const getSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return session;
    };

    const fetchRules = useCallback(async () => {
        setLoading(true);
        try {
            const session = await getSession();
            if (!session) return;
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/workflow-rules`, {
                headers: { Authorization: `Bearer ${session.access_token}` }
            });
            if (res.ok) setRules(await res.json());
        } catch { /* silent */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchRules(); }, [fetchRules]);

    const handleToggle = async (rule: WorkflowRule) => {
        const session = await getSession();
        if (!session) return;
        const updated = { ...rule, is_active: !rule.is_active };
        setRules(rs => rs.map(r => r.rule_id === rule.rule_id ? updated : r));
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/workflow-rules/${rule.rule_id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ is_active: !rule.is_active })
        });
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this workflow rule?')) return;
        const session = await getSession();
        if (!session) return;
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/workflow-rules/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${session.access_token}` }
        });
        setRules(rs => rs.filter(r => r.rule_id !== id));
    };

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const session = await getSession();
            if (!session) return;
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/workflow-rules/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({
                    trigger_field: form.trigger_field,
                    trigger_op: form.trigger_op,
                    trigger_value: form.trigger_value,
                })
            });
            if (res.ok) setTestResult(await res.json());
        } catch { /* silent */ }
        finally { setTesting(false); }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) { setError('Rule name is required'); return; }
        setSaving(true);
        setError(null);
        try {
            const session = await getSession();
            if (!session) return;
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/workflow-rules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify(form)
            });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
            setForm(BLANK_FORM);
            setShowForm(false);
            setTestResult(null);
            await fetchRules();
        } catch (e: any) {
            setError(e.message || 'Failed to save rule');
        } finally {
            setSaving(false);
        }
    };

    const availableOps = TRIGGER_OPS[form.trigger_field] || TRIGGER_OPS.deal_value;

    const needsActionValue = ['send_notification', 'change_stage', 'assign_to'].includes(form.action_type);

    const humanReadableRule = (rule: WorkflowRule) => {
        const field = TRIGGER_FIELDS.find(f => f.value === rule.trigger_field)?.label ?? rule.trigger_field;
        const op = OP_LABEL[rule.trigger_op] ?? rule.trigger_op;
        const act = ACTION_LABEL[rule.action_type] ?? rule.action_type;
        return `IF ${field} ${op} ${rule.trigger_value} THEN ${act}${rule.action_value ? ` = ${rule.action_value}` : ''}`;
    };

    return (
        <div className="space-y-4">
            {/* Header row */}
            <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">
                    {rules.length} rule{rules.length !== 1 ? 's' : ''} defined
                </p>
                <button
                    id="add-workflow-rule-btn"
                    onClick={() => { setShowForm(s => !s); setError(null); setTestResult(null); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium rounded-lg transition-colors"
                >
                    <Plus size={13} />
                    New Rule
                </button>
            </div>

            {/* ── NEW RULE FORM ─────────────────────────────────────────────── */}
            {showForm && (
                <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-5 space-y-4">
                    <h3 className="text-sm font-bold text-violet-800 flex items-center gap-2">
                        <Zap size={14} /> Define Workflow Rule
                    </h3>
                    <form onSubmit={handleSave} className="space-y-4">
                        {/* Name */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Rule Name</label>
                            <input
                                id="workflow-rule-name"
                                value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="e.g. High-Value Deal Alert"
                                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400"
                            />
                        </div>

                        {/* IF row */}
                        <div className="space-y-2">
                            <label className="block text-xs font-semibold text-slate-600">Condition (IF…)</label>
                            <div className="flex gap-2 items-center flex-wrap">
                                {/* Field */}
                                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1.5">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">IF</span>
                                    <select
                                        id="workflow-trigger-field"
                                        value={form.trigger_field}
                                        onChange={e => setForm(f => ({
                                            ...f,
                                            trigger_field: e.target.value,
                                            trigger_op: TRIGGER_OPS[e.target.value]?.[0]?.value ?? 'gt'
                                        }))}
                                        className="text-sm bg-transparent border-none focus:ring-0 font-medium text-slate-700 cursor-pointer"
                                    >
                                        {TRIGGER_FIELDS.map(f => (
                                            <option key={f.value} value={f.value}>{f.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Operator */}
                                <div className="bg-violet-100 border border-violet-200 rounded-lg px-2 py-1.5">
                                    <select
                                        id="workflow-trigger-op"
                                        value={form.trigger_op}
                                        onChange={e => setForm(f => ({ ...f, trigger_op: e.target.value }))}
                                        className="text-sm bg-transparent border-none focus:ring-0 font-bold text-violet-700 cursor-pointer"
                                    >
                                        {availableOps.map(op => (
                                            <option key={op.value} value={op.value}>{op.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Value */}
                                <input
                                    id="workflow-trigger-value"
                                    value={form.trigger_value}
                                    onChange={e => setForm(f => ({ ...f, trigger_value: e.target.value }))}
                                    placeholder="value"
                                    className="w-32 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400 font-mono"
                                />

                                {/* Test button */}
                                <button
                                    type="button"
                                    onClick={handleTest}
                                    disabled={testing}
                                    className="flex items-center gap-1 px-3 py-1.5 border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {testing ? <Loader2 size={11} className="animate-spin" /> : <FlaskConical size={11} />}
                                    Test
                                </button>
                            </div>

                            {/* Test result */}
                            {testResult && (
                                <div className="text-xs rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
                                    <span className="font-bold text-emerald-700">{testResult.matched_count}</span>
                                    <span className="text-slate-600"> of {testResult.total_deals} existing deals match this condition.</span>
                                    {testResult.matched_deals.length > 0 && (
                                        <div className="mt-1.5 flex flex-wrap gap-1">
                                            {testResult.matched_deals.slice(0, 5).map((d: any) => (
                                                <span key={d.deal_id} className="px-1.5 py-0.5 bg-white border border-emerald-200 rounded text-emerald-700 font-mono text-[10px]">
                                                    {d.name}
                                                </span>
                                            ))}
                                            {testResult.matched_deals.length > 5 && (
                                                <span className="text-slate-400 text-[10px]">+{testResult.matched_deals.length - 5} more</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* THEN row */}
                        <div className="space-y-2">
                            <label className="block text-xs font-semibold text-slate-600">Action (THEN…)</label>
                            <div className="flex gap-2 items-center flex-wrap">
                                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1.5">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">THEN</span>
                                    <select
                                        id="workflow-action-type"
                                        value={form.action_type}
                                        onChange={e => setForm(f => ({ ...f, action_type: e.target.value, action_value: '' }))}
                                        className="text-sm bg-transparent border-none focus:ring-0 font-medium text-slate-700 cursor-pointer"
                                    >
                                        {ACTION_TYPES.map(a => (
                                            <option key={a.value} value={a.value}>{a.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {needsActionValue && (
                                    <input
                                        id="workflow-action-value"
                                        value={form.action_value}
                                        onChange={e => setForm(f => ({ ...f, action_value: e.target.value }))}
                                        placeholder={
                                            form.action_type === 'change_stage' ? 'Stage name' :
                                                form.action_type === 'assign_to' ? 'User email' :
                                                    form.action_type === 'send_notification' ? 'Message text' :
                                                        'Value'
                                        }
                                        className="flex-1 min-w-[160px] text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400"
                                    />
                                )}
                            </div>
                        </div>

                        {/* Logic preview */}
                        <div className="rounded-lg bg-slate-800 px-4 py-3">
                            <p className="text-[11px] text-slate-400 font-mono leading-relaxed">
                                <span className="text-yellow-400">IF</span>{' '}
                                <span className="text-sky-300">
                                    {TRIGGER_FIELDS.find(f => f.value === form.trigger_field)?.label ?? form.trigger_field}
                                </span>{' '}
                                <span className="text-violet-400">{OP_LABEL[form.trigger_op] ?? form.trigger_op}</span>{' '}
                                <span className="text-emerald-400">{form.trigger_value || '?'}</span>
                                <br />
                                <span className="text-yellow-400">THEN</span>{' '}
                                <span className="text-sky-300">
                                    {ACTION_TYPES.find(a => a.value === form.action_type)?.label ?? form.action_type}
                                </span>
                                {form.action_value && (
                                    <> = <span className="text-emerald-400">{form.action_value}</span></>
                                )}
                            </p>
                        </div>

                        {error && <p className="text-xs text-red-500">{error}</p>}

                        {/* Submit */}
                        <div className="flex gap-2 justify-end">
                            <button
                                type="button"
                                onClick={() => { setShowForm(false); setError(null); setTestResult(null); }}
                                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
                            >
                                Cancel
                            </button>
                            <button
                                id="save-workflow-rule-btn"
                                type="submit"
                                disabled={saving}
                                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                            >
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                                Save Rule
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ── RULES LIST ────────────────────────────────────────────────── */}
            {loading ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 size={20} className="animate-spin text-slate-400" />
                </div>
            ) : rules.length === 0 && !showForm ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
                    <Zap size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-sm text-slate-400">No workflow rules yet.</p>
                    <p className="text-xs text-slate-400 mt-1">Click "New Rule" to define your first automation.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {rules.map(rule => (
                        <div
                            key={rule.rule_id}
                            className={cn(
                                'rounded-xl border transition-all',
                                rule.is_active
                                    ? 'border-violet-200 bg-white shadow-sm'
                                    : 'border-slate-200 bg-slate-50 opacity-60'
                            )}
                        >
                            {/* Rule summary row */}
                            <div className="flex items-center gap-3 px-4 py-3">
                                {/* Active toggle */}
                                <button
                                    onClick={() => handleToggle(rule)}
                                    className={cn(
                                        'w-9 h-5 rounded-full transition-colors shrink-0 relative',
                                        rule.is_active ? 'bg-violet-500' : 'bg-slate-300'
                                    )}
                                    title={rule.is_active ? 'Deactivate rule' : 'Activate rule'}
                                >
                                    <span className={cn(
                                        'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                                        rule.is_active ? 'translate-x-4' : 'translate-x-0.5'
                                    )} />
                                </button>

                                {/* Expand */}
                                <button
                                    onClick={() => setExpandedRule(expandedRule === rule.rule_id ? null : rule.rule_id)}
                                    className="flex-1 text-left"
                                >
                                    <p className="text-sm font-semibold text-slate-800">{rule.name}</p>
                                    <p className="text-xs text-slate-500 font-mono mt-0.5">{humanReadableRule(rule)}</p>
                                </button>

                                {/* Status badge */}
                                <span className={cn(
                                    'text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0',
                                    rule.is_active
                                        ? 'bg-violet-100 text-violet-700'
                                        : 'bg-slate-200 text-slate-500'
                                )}>
                                    {rule.is_active ? 'ACTIVE' : 'INACTIVE'}
                                </span>

                                {/* Expand chevron */}
                                <button
                                    onClick={() => setExpandedRule(expandedRule === rule.rule_id ? null : rule.rule_id)}
                                    className="text-slate-400 hover:text-slate-600"
                                >
                                    {expandedRule === rule.rule_id
                                        ? <ChevronDown size={15} />
                                        : <ChevronRight size={15} />}
                                </button>

                                {/* Delete */}
                                <button
                                    onClick={() => handleDelete(rule.rule_id)}
                                    className="text-slate-300 hover:text-red-500 transition-colors"
                                    title="Delete rule"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>

                            {/* Expanded detail */}
                            {expandedRule === rule.rule_id && (
                                <div className="border-t border-slate-100 px-4 py-3 grid grid-cols-2 gap-4 text-xs">
                                    <div>
                                        <span className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">Trigger Field</span>
                                        <p className="font-semibold text-slate-700 mt-0.5">
                                            {TRIGGER_FIELDS.find(f => f.value === rule.trigger_field)?.label ?? rule.trigger_field}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">Condition</span>
                                        <p className="font-semibold text-slate-700 mt-0.5 font-mono">
                                            {OP_LABEL[rule.trigger_op] ?? rule.trigger_op} {rule.trigger_value}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">Action</span>
                                        <p className="font-semibold text-slate-700 mt-0.5">
                                            {ACTION_TYPES.find(a => a.value === rule.action_type)?.label ?? rule.action_type}
                                        </p>
                                    </div>
                                    {rule.action_value && (
                                        <div>
                                            <span className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">Action Value</span>
                                            <p className="font-semibold text-slate-700 mt-0.5 font-mono">{rule.action_value}</p>
                                        </div>
                                    )}
                                    {rule.created_by_email && (
                                        <div className="col-span-2 text-[10px] text-slate-400">
                                            Created by {rule.created_by_email} · {new Date(rule.created_at).toLocaleDateString()}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
