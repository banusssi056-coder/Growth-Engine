import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Deal {
    deal_id: string;
    name: string;
    company_name: string;
    owner_email?: string;
    value: number;
    stage: string;
    level?: string;
    offering?: string;
    priority?: number;
    frequency?: string;
    remark?: string;
}

interface DealsTableProps {
    deals: Deal[];
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

export function DealsTable({ deals }: DealsTableProps) {
    const [localDeals, setLocalDeals] = useState(deals);

    useEffect(() => {
        setLocalDeals(deals);
    }, [deals]);

    const handleStageChange = async (dealId: string, newStage: string) => {
        setLocalDeals(prev => prev.map(d => d.deal_id === dealId ? { ...d, stage: newStage } : d));

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/deals/${dealId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ stage: newStage })
            });
        } catch (err) {
            console.error("Failed to update stage", err);
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
                        <th className="px-3 py-2 bg-orange-500 text-white w-16 text-center border-r border-slate-200">LH Prio</th>
                        <th className="px-3 py-2 bg-lime-300 text-slate-800 w-48 border-r border-slate-200">Solid Deal</th>
                        <th className="px-3 py-2 bg-lime-300 text-slate-800 w-40 border-r border-slate-200">Offering</th>
                        <th className="px-3 py-2 bg-lime-300 text-slate-800 w-40 border-r border-slate-200">Who Pays</th>
                        <th className="px-3 py-2 bg-orange-500 text-white w-32 border-r border-slate-200">Sales Force</th>
                        <th className="px-3 py-2 bg-amber-100 text-slate-800 text-right w-32 border-r border-slate-200">Amount</th>
                        <th className="px-3 py-2 bg-lime-300 text-slate-800 w-24 border-r border-slate-200">Frequency</th>
                        <th className="px-3 py-2 bg-orange-500 text-white w-40 border-r border-slate-200">Stage</th>
                        <th className="px-3 py-2 bg-lime-300 text-slate-800 min-w-[200px]">Remark</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                    {localDeals.map((deal) => (
                        <tr key={deal.deal_id} className="hover:bg-slate-50 transition-colors group">
                            <td className="px-3 py-2 text-center text-slate-600 border-r border-slate-100 bg-slate-50/50">{deal.priority || '-'}</td>
                            <td className="px-3 py-2 font-medium text-slate-900 border-r border-slate-100">{deal.name}</td>
                            <td className="px-3 py-2 text-slate-600 border-r border-slate-100 text-xs">{deal.offering || '-'}</td>
                            <td className="px-3 py-2 text-slate-600 border-r border-slate-100">{deal.company_name || '-'}</td>
                            <td className="px-3 py-2 text-slate-600 border-r border-slate-100 capitalize">{deal.owner_email ? deal.owner_email.split('@')[0] : '-'}</td>
                            <td className="px-3 py-2 text-right font-medium text-slate-900 border-r border-slate-100">
                                ₹{Number(deal.value).toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-slate-600 border-r border-slate-100">{deal.frequency || '-'}</td>
                            <td className="px-3 py-2 text-slate-600 border-r border-slate-100">
                                <select
                                    value={deal.stage}
                                    onChange={(e) => handleStageChange(deal.deal_id, e.target.value)}
                                    className={`block w-full rounded border-0 py-1 pl-2 text-[10px] font-medium cursor-pointer focus:ring-1 focus:ring-inset focus:ring-slate-300
                                    ${deal.stage.startsWith('1') || deal.stage.startsWith('Lead') ? 'bg-blue-50 text-blue-700' :
                                            deal.stage.startsWith('8') || deal.stage.includes('Paid') ? 'bg-emerald-50 text-emerald-700' :
                                                deal.stage.startsWith('9') || deal.stage.includes('Lost') ? 'bg-red-50 text-red-700' :
                                                    'bg-amber-50 text-amber-700'}`}
                                >
                                    {STAGES.map(s => <option key={s} value={s} className="bg-white text-slate-800">{s}</option>)}
                                </select>
                            </td>
                            <td className="px-3 py-2 text-slate-500 italic text-xs max-w-xs truncate group-hover:whitespace-normal group-hover:overflow-visible group-hover:z-10 bg-white">{deal.remark || ''}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
