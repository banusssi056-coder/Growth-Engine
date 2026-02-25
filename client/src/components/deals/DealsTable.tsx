import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/currency';
import { LeadScoreBadge } from './LeadScoreBadge';

interface Deal {
    deal_id: string;
    name: string;
    company_name: string;
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
}

interface DealsTableProps {
    deals: Deal[];
    userRole?: string;
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

export function DealsTable({ deals, userRole, onDealUpdated }: DealsTableProps) {
    const isReadOnly = userRole === 'intern';
    const [localDeals, setLocalDeals] = useState(deals);

    useEffect(() => {
        setLocalDeals(deals);
    }, [deals]);

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
            <table className="w-full text-sm text-left border-collapse">
                <thead>
                    <tr className="border-b font-semibold text-slate-800 text-xs uppercase tracking-wider">
                        <th className="px-2 py-2 bg-orange-500 text-white w-14 text-center border-r border-slate-200">Prio</th>
                        <th className="px-3 py-2 bg-lime-300 text-slate-800 w-44 border-r border-slate-200">Solid Deal</th>
                        <th className="px-3 py-2 bg-lime-300 text-slate-800 w-36 border-r border-slate-200">Offering</th>
                        <th className="px-3 py-2 bg-lime-300 text-slate-800 w-24 border-r border-slate-200">Level</th>
                        <th className="px-3 py-2 bg-lime-300 text-slate-800 w-36 border-r border-slate-200">Who Pays</th>
                        <th className="px-3 py-2 bg-orange-500 text-white w-28 border-r border-slate-200">Sales Force</th>
                        <th className="px-3 py-2 bg-amber-100 text-slate-800 text-right w-28 border-r border-slate-200">Amount</th>
                        <th className="px-3 py-2 bg-lime-300 text-slate-800 w-24 border-r border-slate-200">Frequency</th>
                        <th className="px-3 py-2 bg-orange-500 text-white w-32 border-r border-slate-200 text-center">Activity</th>
                        <th className="px-3 py-2 bg-orange-500 text-white border-r border-slate-200" style={{ minWidth: '220px' }}>Stage</th>
                        <th className="px-3 py-2 bg-lime-300 text-slate-800" style={{ minWidth: '220px' }}>Remark</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                    {localDeals.map((deal) => (
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
                            <td className="px-3 py-2.5 text-slate-600 border-r border-slate-100 text-xs capitalize">{deal.owner_email ? deal.owner_email.split('@')[0] : '-'}</td>
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

                            {/* ── Stage dropdown — wide enough to show full stage name ── */}
                            <td className="px-2 py-2 border-r border-slate-100">
                                <select
                                    value={deal.stage}
                                    disabled={isReadOnly}
                                    onChange={(e) => handleStageChange(deal.deal_id, e.target.value)}
                                    style={{ minWidth: '200px' }}
                                    className={`block w-full rounded py-1.5 px-2 text-xs font-medium 
                                        border focus:outline-none focus:ring-2 focus:ring-inset focus:ring-slate-400
                                        ${isReadOnly ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}
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
                                    readOnly={isReadOnly}
                                    onChange={(val) => handleRemarkChange(deal.deal_id, val)}
                                    onBlur={(val) => handleRemarkBlur(deal.deal_id, val)}
                                />
                            </td>
                        </tr>
                    ))}
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
