import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/currency';
import { LeadScoreBadge } from './LeadScoreBadge';

interface Deal {
    deal_id: string;
    name: string;
    company_name: string;
    owner_id?: string;
    owner_email?: string;
    value: number;
    stage: string;
    probability?: number;
    level?: string;
    offering?: string;
    priority?: number;
    frequency?: string;
    remark?: string;
    lead_score?: number;
    last_activity_date?: string;
    next_follow_up?: string;
    follow_up_notified?: boolean;
}

interface DealsTableProps {
    deals: Deal[];
    userRole?: string;
    userId?: string | null;
    onDealUpdated?: (dealId: string, patch: Partial<Deal>) => void;
}

const STAGES = [
    "1- New Lead",
    "2- Discussing, RFQing",
    "3- Presenting, Quoting",
    "4- Negotiating, Closing",
    "5- WIP",
    "6- Invoice, Payment pending",
    "7- Hold",
    "8- Paid",
    "9- Lost"
];

// Probability (%) assigned automatically when a stage is selected
const STAGE_PROBABILITIES: Record<string, number> = {
    "1- New Lead": 10,
    "2- Discussing, RFQing": 20,
    "3- Presenting, Quoting": 40,
    "4- Negotiating, Closing": 60,
    "5- WIP": 80,
    "6- Invoice, Payment pending": 90,
    "7- Hold": 10,
    "8- Paid": 100,
    "9- Lost": 0,
};

export function DealsTable({ deals, userRole, userId, onDealUpdated }: DealsTableProps) {
    const canReassign = userRole === 'admin' || userRole === 'manager';
    const [localDeals, setLocalDeals] = useState(deals);
    const [teamMembers, setTeamMembers] = useState<any[]>([]);

    useEffect(() => {
        setLocalDeals(deals);
    }, [deals]);

    useEffect(() => {
        if (canReassign) {
            fetchTeamMembers();
        }
    }, [canReassign]);

    const fetchTeamMembers = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/team`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            const data = await res.json();
            if (Array.isArray(data)) setTeamMembers(data);
        } catch (err) {
            console.error("Failed to fetch team members", err);
        }
    };

    const handleStageChange = async (dealId: string, newStage: string) => {
        // Derive new probability from the stage map
        const newProbability = STAGE_PROBABILITIES[newStage] ?? 10;

        // Optimistic UI update: update both stage and probability locally
        setLocalDeals(prev =>
            prev.map(d =>
                d.deal_id === dealId ? { ...d, stage: newStage, probability: newProbability } : d
            )
        );

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/deals/${dealId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                // Send both stage AND probability so weighted forecast recalculates on the server
                body: JSON.stringify({ stage: newStage, probability: newProbability })
            });

            // Tell parent so switching views doesn't revert the change
            onDealUpdated?.(dealId, { stage: newStage, probability: newProbability });
        } catch (err) {
            console.error("Failed to update stage", err);
        }
    };

    const handleOwnerChange = async (dealId: string, newOwnerId: string) => {
        const owner = teamMembers.find(u => u.user_id === newOwnerId);
        if (!owner) return;

        // Optimistic UI update
        setLocalDeals(prev =>
            prev.map(d =>
                d.deal_id === dealId ? { ...d, owner_id: newOwnerId, owner_email: owner.email } : d
            )
        );

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/deals/${dealId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ owner_id: newOwnerId })
            });

            onDealUpdated?.(dealId, { owner_id: newOwnerId, owner_email: owner.email });
        } catch (err) {
            console.error("Failed to reassign owner", err);
        }
    };

    const handleFollowUpChange = async (dealId: string, value: string) => {
        // Optimistic UI update
        setLocalDeals(prev =>
            prev.map(d => d.deal_id === dealId ? { ...d, next_follow_up: value, follow_up_notified: false } : d)
        );

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/deals/${dealId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ next_follow_up: value || null })
            });

            onDealUpdated?.(dealId, { next_follow_up: value || undefined });
        } catch (err) {
            console.error("Failed to update follow-up", err);
        }
    };

    const handleRemarkChange = (dealId: string, value: string) => {
        setLocalDeals(prev => prev.map(d => d.deal_id === dealId ? { ...d, remark: value } : d));
    };

    const handleRemarkBlur = async (dealId: string, value: string) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/deals/${dealId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ remark: value })
            });

            // Tell parent so switching views doesn't revert the change
            onDealUpdated?.(dealId, { remark: value });
        } catch (err) {
            console.error("Failed to update remark", err);
        }
    };

    if (!localDeals || localDeals.length === 0) {
        return <div className="p-12 text-center text-slate-500 bg-white rounded-lg border border-dashed border-slate-300">No deals found. Create a deal to get started.</div>;
    }

    return (
        <div className="overflow-x-auto border rounded-none shadow-sm bg-white">
            <table className="w-full text-sm text-left border-collapse min-w-[1600px]">
                <thead className="sticky top-0 z-20 shadow-sm">
                    <tr className="border-b font-semibold text-xs uppercase tracking-wider">
                        <th className="px-2 py-2 bg-orange-600 text-white w-14 text-center border-r border-slate-200 sticky top-0">Prio</th>
                        <th className="px-3 py-2 bg-lime-400 text-slate-900 w-44 border-r border-slate-200 sticky top-0">Solid Deal</th>
                        <th className="px-3 py-2 bg-lime-400 text-slate-900 w-36 border-r border-slate-200 sticky top-0">Offering</th>
                        <th className="px-3 py-2 bg-lime-400 text-slate-900 w-24 border-r border-slate-200 sticky top-0">Level</th>
                        <th className="px-3 py-2 bg-lime-400 text-slate-900 w-36 border-r border-slate-200 sticky top-0">Who Pays</th>
                        <th className="px-3 py-2 bg-orange-600 text-white w-28 border-r border-slate-200 sticky top-0">Sales Force</th>
                        <th className="px-3 py-2 bg-amber-200 text-slate-900 text-right w-28 border-r border-slate-200 sticky top-0">Amount</th>
                        <th className="px-3 py-2 bg-lime-400 text-slate-900 w-24 border-r border-slate-200 sticky top-0">Frequency</th>
                        <th className="px-3 py-2 bg-orange-600 text-white w-32 border-r border-slate-200 text-center sticky top-0">Activity</th>
                        <th className="px-3 py-2 bg-orange-600 text-white w-40 border-r border-slate-200 text-center sticky top-0">Follow-up</th>
                        <th className="px-3 py-2 bg-orange-600 text-white border-r border-slate-200 sticky top-0" style={{ minWidth: '220px' }}>Stage</th>
                        <th className="px-3 py-2 bg-lime-400 text-slate-900 sticky top-0" style={{ minWidth: '220px' }}>Remark</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                    {localDeals.map((deal) => {
                        const rowReadOnly = userRole === 'intern' || (userRole === 'rep' && deal.owner_id !== userId);
                        return (
                            <tr key={deal.deal_id} className="hover:bg-slate-50 transition-colors group align-top">
                                <td className="px-2 py-2.5 text-center text-slate-600 border-r border-slate-100 bg-slate-50/50 text-xs">{deal.priority || '-'}</td>
                                <td className="px-3 py-2.5 border-r border-slate-100">
                                    <div className="font-medium text-slate-900 text-sm mb-1">{deal.name}</div>
                                    <LeadScoreBadge dealId={deal.deal_id} initialScore={deal.lead_score || 0} size="sm" />
                                </td>
                                <td className="px-3 py-2.5 text-slate-600 border-r border-slate-100 text-xs">{deal.offering || '-'}</td>
                                {/* Level badge */}
                                <td className="px-3 py-2.5 border-r border-slate-100">
                                    {deal.level ? (
                                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide
                                        ${deal.level === 'Enterprise'
                                                ? 'bg-purple-100 text-purple-700'
                                                : deal.level === 'Premium'
                                                    ? 'bg-amber-100 text-amber-700'
                                                    : 'bg-slate-100 text-slate-600'
                                            }`}
                                        >
                                            {deal.level}
                                        </span>
                                    ) : (
                                        <span className="text-slate-400 text-xs">-</span>
                                    )}
                                </td>
                                <td className="px-3 py-2.5 text-slate-600 border-r border-slate-100 text-xs">{deal.company_name || '-'}</td>
                                <td className="px-3 py-2.5 text-slate-600 border-r border-slate-100 text-xs text-center">
                                    {canReassign ? (
                                        <select
                                            value={deal.owner_id || ''}
                                            onChange={(e) => handleOwnerChange(deal.deal_id, e.target.value)}
                                            className="bg-transparent border-none p-0 text-xs focus:ring-0 cursor-pointer hover:text-slate-900"
                                        >
                                            <option value="" disabled>Unassigned</option>
                                            {/* If the current owner is inactive (not in teamMembers), show them as an option so the select has a label */}
                                            {deal.owner_id && !teamMembers.find(m => m.user_id === deal.owner_id) && (
                                                <option value={deal.owner_id}>
                                                    {deal.owner_email ? deal.owner_email.split('@')[0] : 'Inactive User'} (Inactive)
                                                </option>
                                            )}
                                            {teamMembers.map(m => (
                                                <option key={m.user_id} value={m.user_id}>
                                                    {m.full_name || m.email.split('@')[0]}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <span className="capitalize">{deal.owner_email ? deal.owner_email.split('@')[0] : '-'}</span>
                                    )}
                                </td>
                                <td className="text-right font-medium text-slate-900 border-r border-slate-100 px-3 py-2.5 text-sm">
                                    {formatCurrency(deal.value)}
                                </td>
                                <td className="px-3 py-2.5 text-slate-600 border-r border-slate-100 text-xs">{deal.frequency || '-'}</td>

                                {/* ── Last Activity Date ── */}
                                <td className="px-3 py-2.5 text-center border-r border-slate-100">
                                    {deal.last_activity_date ? (
                                        <div className="flex flex-col items-center">
                                            <div className="text-[11px] font-medium text-slate-700">
                                                {new Date(deal.last_activity_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                            </div>
                                            <div className="text-[9px] text-slate-400">
                                                {new Date(deal.last_activity_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-slate-400 text-xs">-</span>
                                    )}
                                </td>

                                {/* ── Next Follow-up ── */}
                                <td className="px-2 py-2 border-r border-slate-100 text-center">
                                    <input
                                        type="datetime-local"
                                        value={deal.next_follow_up ? deal.next_follow_up.slice(0, 16) : ''}
                                        onChange={(e) => handleFollowUpChange(deal.deal_id, e.target.value)}
                                        className={`w-full bg-transparent border-none p-0 text-[10px] focus:ring-0 cursor-pointer 
                                        ${deal.follow_up_notified ? 'text-slate-400 line-through' : 'text-slate-700 font-medium'}
                                        hover:bg-slate-100 rounded transition-colors
                                    `}
                                    />
                                    {deal.next_follow_up && !deal.follow_up_notified && new Date(deal.next_follow_up) < new Date() && (
                                        <div className="text-[9px] text-red-500 font-bold uppercase mt-0.5">Overdue</div>
                                    )}
                                </td>

                                {/* ── Stage dropdown — wide enough to show full stage name ── */}
                                <td className="px-2 py-2 border-r border-slate-100">
                                    <select
                                        value={deal.stage}
                                        disabled={rowReadOnly}
                                        onChange={(e) => handleStageChange(deal.deal_id, e.target.value)}
                                        style={{ minWidth: '200px' }}
                                        className={`block w-full rounded py-1.5 px-2 text-xs font-medium 
                                        border focus:outline-none focus:ring-2 focus:ring-inset focus:ring-slate-400
                                        ${rowReadOnly ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}
                                        ${deal.stage.startsWith('1') ? 'bg-blue-50    text-blue-800    border-blue-200' :
                                                deal.stage.startsWith('8') ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                                                    deal.stage.startsWith('9') ? 'bg-red-50     text-red-800     border-red-200' :
                                                        deal.stage.startsWith('7') ? 'bg-slate-100  text-slate-700   border-slate-300' :
                                                            'bg-amber-50   text-amber-800   border-amber-200'}
                                    `}
                                    >
                                        {STAGES.map(s => <option key={s} value={s} className="bg-white text-slate-800">{s}</option>)}
                                    </select>
                                </td>

                                {/* ── Remark — Always visible full text ── */}
                                <td className="px-2 py-2 bg-white">
                                    <RemarkTextarea
                                        value={deal.remark || ''}
                                        readOnly={rowReadOnly}
                                        onChange={(val) => handleRemarkChange(deal.deal_id, val)}
                                        onBlur={(val) => handleRemarkBlur(deal.deal_id, val)}
                                    />
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    );
}

/**
 * Helper component to handle auto-resizing textarea for remarks
 */
function RemarkTextarea({
    value,
    readOnly,
    onChange,
    onBlur
}: {
    value: string;
    readOnly: boolean;
    onChange: (val: string) => void;
    onBlur: (val: string) => void;
}) {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    // Auto-resize on mount and value change
    const resize = () => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    };

    useEffect(() => {
        resize();
    }, [value]);

    return (
        <textarea
            ref={textareaRef}
            value={value}
            readOnly={readOnly}
            onChange={(e) => {
                if (readOnly) return;
                onChange(e.target.value);
            }}
            onBlur={(e) => {
                if (readOnly) return;
                onBlur(e.target.value);
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    (e.target as HTMLTextAreaElement).blur();
                }
            }}
            style={{ minWidth: '220px', minHeight: '32px' }}
            className={`w-full resize-none overflow-hidden border-none bg-transparent text-xs text-slate-600 focus:ring-0 placeholder:text-slate-300 p-0 leading-relaxed ${readOnly ? 'cursor-default' : ''}`}
            placeholder={readOnly ? '' : "Add remark…"}
        />
    );
}
