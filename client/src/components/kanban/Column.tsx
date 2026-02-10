
'use client';
import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableDealCard } from './DealCard';

interface ColumnProps {
    id: string;
    title: string;
    deals: any[];
    onLogActivity: (dealId: string) => void;
}

export function Column({ id, title, deals, onLogActivity }: ColumnProps) {
    const { setNodeRef } = useDroppable({ id });

    return (
        <div ref={setNodeRef} className="flex h-full w-80 flex-col rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-700">{title}</h3>
                <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    {deals.length}
                </span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 min-h-[100px]">
                <SortableContext
                    items={deals.map(d => d.deal_id).filter(Boolean)}
                    strategy={verticalListSortingStrategy}
                >
                    {deals.map((deal) => (
                        <div key={deal.deal_id}>
                            <SortableDealCard deal={deal} onLogActivity={onLogActivity} />
                        </div>
                    ))}
                </SortableContext>
                {deals.length === 0 && (
                    <div className="h-full flex items-center justify-center text-slate-300 text-sm italic py-4">
                        Drop items here
                    </div>
                )}
            </div>
        </div>
    );
}
