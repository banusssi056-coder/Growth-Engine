'use client';
import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { DealCard } from './DealCard';

interface ColumnProps {
    id: string;
    title: string;
    deals: any[];
}

export function Column({ id, title, deals }: ColumnProps) {
    const { setNodeRef } = useDroppable({ id });

    return (
        <div className="flex-1 min-w-[300px] bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h3 className="font-semibold text-slate-700 mb-4 flex justify-between items-center">
                {title}
                <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs">
                    {deals.length}
                </span>
            </h3>

            <div ref={setNodeRef} className="flex flex-col min-h-[500px]">
                <SortableContext items={deals.map(d => d.deal_id)} strategy={verticalListSortingStrategy}>
                    {deals.map((deal) => (
                        <DealCard key={deal.deal_id} deal={deal} />
                    ))}
                </SortableContext>
                {deals.length === 0 && (
                    <div className="flex-1 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center text-slate-400 text-sm">
                        Drop here
                    </div>
                )}
            </div>
        </div>
    );
}
