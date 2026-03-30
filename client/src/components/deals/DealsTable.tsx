import React, { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/auth-utils';
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
            const token = await getAuthToken();
            if (!token) return;
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/team`, {
                headers: { 'Authorization': `Bearer ${token}` }
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
            const token = await getAuthToken();
            if (!token) return;

            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/deals/${dealId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
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
            const token = await getAuthToken();
            if (!token) return;

            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/deals/${dealId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
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
            const token = await getAuthToken();
            if (!token) return;

            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/deals/${dealId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
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
            const token = await getAuthToken();
            if (!token) return;

            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/deals/${dealId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
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
        <div className="w-full border rounded-xl shadow-sm bg-white custom-scrollbar overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse min-w-full border-separate border-spacing-0">
                <thead className="sticky top-0 z-40">
                    <tr className="font-semibold text-[10px] uppercase tracking-wider text-slate-500">
                        <th className="px-2 py-4 bg-slate-50/95 backdrop-blur-md w-14 text-center border-b border-r border-slate-200 sticky top-0 left-0 z-50">#</th>
                        <th className="px-4 py-4 bg-slate-50/95 backdrop-blur-md min-w-[200px] border-b border-r border-slate-200 sticky top-0 left-14 z-50 shadow-[2px_0_10px_rgba(0,0,0,0.03)]">Opportunity</th>
                        <th className="px-4 py-4 bg-slate-50/95 backdrop-blur-md w-24 border-b border-r border-slate-200 sticky top-0 text-center">Score</th>
                        <th className="px-4 py-4 bg-slate-50/95 backdrop-blur-md min-w-[150px] border-b border-r border-slate-200 sticky top-0">Offering</th>
                        <th className="px-4 py-4 bg-slate-50/95 backdrop-blur-md w-24 border-b border-r border-slate-200 sticky top-0">Tier</th>
                        <th className="px-4 py-4 bg-slate-50/95 backdrop-blur-md border-b border-r border-slate-200 sticky top-0">Account</th>
                        <th className="px-4 py-4 bg-slate-50/95 backdrop-blur-md w-36 border-b border-r border-slate-200 sticky top-0 text-center">Owner</th>
                        <th className="px-4 py-4 bg-slate-50/95 backdrop-blur-md w-32 border-b border-r border-slate-200 sticky top-0 text-right">Value</th>
                        <th className="px-4 py-4 bg-slate-50/95 backdrop-blur-md w-28 border-b border-r border-slate-200 sticky top-0 text-center">Cycle</th>
                        <th className="px-4 py-4 bg-slate-50/95 backdrop-blur-md w-32 border-b border-r border-slate-200 sticky top-0 text-center">Last Activity</th>
                        <th className="px-4 py-4 bg-slate-50/95 backdrop-blur-md w-40 border-b border-r border-slate-200 sticky top-0 text-center">Next Step</th>
                        <th className="px-4 py-4 bg-slate-50/95 backdrop-blur-md min-w-[220px] border-b border-r border-slate-200 sticky top-0">Status</th>
                        <th className="px-4 py-4 bg-slate-50/95 backdrop-blur-md min-w-[250px] border-b sticky top-0">Notes</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                    {localDeals.map((deal) => {
                        const rowReadOnly = userRole === 'intern' || (userRole === 'rep' && deal.owner_id !== userId);
                        return (
                            <tr key={deal.deal_id} className="hover:bg-slate-50/80 transition-all group align-top">
                                <td className="px-2 py-4 text-center text-slate-400 border-r border-slate-100 bg-slate-50/30 sticky left-0 z-10 text-[11px] font-mono">{deal.priority || '-'}</td>
                                <td className="px-4 py-4 border-r border-slate-100 bg-white sticky left-14 z-10 shadow-[2px_0_10px_rgba(0,0,0,0.01)]">
                                    <div className="font-semibold text-slate-800 text-sm mb-1 line-clamp-1">{deal.name}</div>
                                </td>
                                <td className="px-4 py-4 border-r border-slate-100 text-center">
                                    <LeadScoreBadge dealId={deal.deal_id} initialScore={deal.lead_score || 0} size="md" showLabel={true} />
                                </td>
                                <td className="px-4 py-4 text-slate-600 border-r border-slate-100 text-xs">
                                    <span className="bg-slate-100 px-2 py-1 rounded text-slate-700">{deal.offering || '-'}</span>
                                </td>
                                <td className="px-4 py-4 border-r border-slate-100">
                                    {deal.level ? (
                                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider
                                        ${deal.level === 'Enterprise'
                                                ? 'bg-indigo-100 text-indigo-700'
                                                : deal.level === 'Premium'
                                                    ? 'bg-amber-100 text-amber-700'
                                                    : 'bg-emerald-100 text-emerald-700'
                                            }`}
                                        >
                                            {deal.level}
                                        </span>
                                    ) : (
                                        <span className="text-slate-300 text-xs">-</span>
                                    )}
                                </td>
                                <td className="px-4 py-4 text-slate-700 border-r border-slate-100 text-xs font-medium">{deal.company_name || '-'}</td>
                                <td className="px-4 py-4 text-slate-600 border-r border-slate-100 text-xs text-center">
                                    {canReassign ? (
                                        <select
                                            value={deal.owner_id || ''}
                                            onChange={(e) => handleOwnerChange(deal.deal_id, e.target.value)}
                                            className="bg-transparent border-none p-0 text-xs focus:ring-0 cursor-pointer hover:text-slate-900 w-full text-center"
                                        >
                                            <option value="" disabled>Unassigned</option>
                                            {deal.owner_id && !teamMembers.find(m => m.user_id === deal.owner_id) && (
                                                <option value={deal.owner_id}>
                                                    {deal.owner_email ? deal.owner_email.split('@')[0] : 'Inactive'}
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
                                <td className="text-right font-bold text-slate-900 border-r border-slate-100 px-4 py-4 text-sm">
                                    {formatCurrency(deal.value)}
                                </td>
                                <td className="px-4 py-4 text-slate-500 border-r border-slate-100 text-[11px] text-center font-medium capitalize">{deal.frequency || '-'}</td>

                                <td className="px-4 py-4 text-center border-r border-slate-100">
                                    {deal.last_activity_date ? (
                                        <div className="flex flex-col items-center">
                                            <div className="text-[11px] font-bold text-slate-700">
                                                {new Date(deal.last_activity_date).toLocaleDateString('en-GB', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: 'numeric'
                                                })}
                                            </div>
                                            <div className="text-[10px] text-slate-500 font-medium">
                                                {new Date(deal.last_activity_date).toLocaleTimeString('en-GB', {
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-slate-300 text-xs">-</span>
                                    )}
                                </td>

                                <td className="px-4 py-4 border-r border-slate-100 text-center">
                                    <input
                                        type="datetime-local"
                                        value={deal.next_follow_up ? deal.next_follow_up.slice(0, 16) : ''}
                                        onChange={(e) => handleFollowUpChange(deal.deal_id, e.target.value)}
                                        className={`w-full bg-slate-50 border-none px-2 py-1 text-[10px] focus:ring-2 focus:ring-slate-200 cursor-pointer rounded-md
                                        ${deal.follow_up_notified ? 'text-slate-400 line-through' : 'text-slate-700 font-bold'}
                                        transition-all
                                    `}
                                    />
                                    {deal.next_follow_up && !deal.follow_up_notified && new Date(deal.next_follow_up) < new Date() && (
                                        <div className="text-[9px] text-rose-500 font-black uppercase mt-1">Overdue</div>
                                    )}
                                </td>

                                <td className="px-4 py-4 border-r border-slate-100">
                                    <select
                                        value={deal.stage}
                                        disabled={rowReadOnly}
                                        onChange={(e) => handleStageChange(deal.deal_id, e.target.value)}
                                        className={`block w-full rounded-lg py-1.5 px-3 text-[10px] font-bold uppercase tracking-wider
                                        border-none focus:ring-2 focus:ring-slate-300
                                        ${rowReadOnly ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}
                                        ${deal.stage.startsWith('1') ? 'bg-blue-100    text-blue-700' :
                                                deal.stage.startsWith('8') ? 'bg-emerald-100 text-emerald-700' :
                                                    deal.stage.startsWith('9') ? 'bg-rose-100     text-rose-700' :
                                                        deal.stage.startsWith('7') ? 'bg-slate-200  text-slate-700' :
                                                            'bg-amber-100   text-amber-800'}
                                    `}
                                    >
                                        {STAGES.map(s => <option key={s} value={s} className="bg-white text-slate-800 lowercase">{s}</option>)}
                                    </select>
                                </td>

                                <td className="px-4 py-4">
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
