'use client';
import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { GripVertical } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { LeadScoreBadge } from '../deals/LeadScoreBadge';

export interface Deal {
    deal_id: string;
    name: string;
    company_name: string;
    value: number;
    level?: string;
    offering?: string;
    priority?: number;
    frequency?: string;
    remark?: string;
    lead_score?: number;
}

interface DealCardProps {
    deal: Deal;
    onLogActivity?: (dealId: string) => void;
    isOverlay?: boolean;
}

export function DealCard({ deal, onLogActivity, isOverlay }: DealCardProps) {
    return (
        <Card className={`group cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow relative ${isOverlay ? 'shadow-xl cursor-grabbing' : ''}`}>
            <CardHeader className="p-4 flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{deal.name}</div>
                    <div className="mt-1">
                        <LeadScoreBadge dealId={deal.deal_id} initialScore={deal.lead_score || 0} size="sm" />
                    </div>
                </div>
                {!isOverlay && (
                    <div className="flex gap-1">
                        <button
                            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-emerald-600"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                                e.stopPropagation();
                                onLogActivity?.(deal.deal_id);
                            }}
                        >
                            <GripVertical className="h-4 w-4" />
                        </button>
                    </div>
                )}
            </CardHeader>
            <CardContent className="p-4 pt-0">
                <div className="text-xs text-gray-500">{deal.company_name}</div>
                <div className="flex flex-wrap gap-1 mt-2 mb-1">
                    {deal.offering && (
                        <span className="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 border border-blue-100">
                            {deal.offering}
                        </span>
                    )}
                    {deal.level && (
                        <span className="inline-flex items-center rounded bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-700 border border-purple-100">
                            {deal.level}
                        </span>
                    )}
                    {deal.priority !== null && deal.priority !== undefined && (
                        <span className="inline-flex items-center rounded bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-100">
                            P: {deal.priority}
                        </span>
                    )}
                </div>

                {deal.remark && (
                    <div className="text-[10px] text-slate-500 italic mb-2 line-clamp-2">
                        {deal.remark}
                    </div>
                )}

                <div className="flex justify-between items-end mt-2">
                    <div className="font-bold text-lg">
                        {formatCurrency(deal.value)}
                        {deal.frequency && (
                            <span className="text-[10px] font-normal text-slate-400 ml-1">
                                / {deal.frequency}
                            </span>
                        )}
                    </div>
                    {!isOverlay && (
                        <button
                            className="p-1 hover:bg-emerald-50 rounded text-slate-400 hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                                e.stopPropagation();
                                onLogActivity?.(deal.deal_id);
                            }}
                            title="Log Activity"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        </button>
                    )}
                </div>
            </CardContent>
        </Card >
    );
}

export function SortableDealCard({ deal, onLogActivity }: DealCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: deal.deal_id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="mb-3">
            <DealCard deal={deal} onLogActivity={onLogActivity} />
        </div>
    );
}
