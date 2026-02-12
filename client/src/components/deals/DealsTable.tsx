import React from 'react';

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

export function DealsTable({ deals }: DealsTableProps) {
    if (!deals || deals.length === 0) {
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
                    {deals.map((deal) => (
                        <tr key={deal.deal_id} className="hover:bg-slate-50 transition-colors group">
                            <td className="px-3 py-2 text-center text-slate-600 border-r border-slate-100 bg-slate-50/50">{deal.priority || '-'}</td>
                            <td className="px-3 py-2 font-medium text-slate-900 border-r border-slate-100">{deal.name}</td>
                            <td className="px-3 py-2 text-slate-600 border-r border-slate-100 text-xs">{deal.offering || '-'}</td>
                            <td className="px-3 py-2 text-slate-600 border-r border-slate-100">{deal.company_name}</td>
                            <td className="px-3 py-2 text-slate-600 border-r border-slate-100 capitalize">{deal.owner_email ? deal.owner_email.split('@')[0] : '-'}</td>
                            <td className="px-3 py-2 text-right font-medium text-slate-900 border-r border-slate-100">
                                ₹{Number(deal.value).toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-slate-600 border-r border-slate-100">{deal.frequency || '-'}</td>
                            <td className="px-3 py-2 text-slate-600 border-r border-slate-100">
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium 
                                    ${deal.stage.startsWith('1') || deal.stage.startsWith('Lead') ? 'bg-blue-50 text-blue-700' :
                                        deal.stage.startsWith('8') || deal.stage.includes('Paid') ? 'bg-emerald-50 text-emerald-700' :
                                            deal.stage.startsWith('9') || deal.stage.includes('Lost') ? 'bg-red-50 text-red-700' :
                                                'bg-amber-50 text-amber-700'}`}>
                                    {deal.stage}
                                </span>
                            </td>
                            <td className="px-3 py-2 text-slate-500 italic text-xs max-w-xs truncate group-hover:whitespace-normal group-hover:overflow-visible group-hover:z-10 bg-white">{deal.remark || ''}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
