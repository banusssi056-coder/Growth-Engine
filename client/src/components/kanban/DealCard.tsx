'use client';
import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { GripVertical } from 'lucide-react';

interface Deal {
    deal_id: string;
    name: string;
    company_name: string;
    value: number;
}

interface DealCardProps {
    deal: Deal;
}

export function DealCard({ deal }: DealCardProps) {
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
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="mb-3">
            <Card className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
                <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="font-medium text-sm truncate">{deal.name}</div>
                    <GripVertical className="h-4 w-4 text-gray-400" />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <div className="text-xs text-gray-500">{deal.company_name}</div>
                    <div className="font-bold text-lg mt-1">
                        ${Number(deal.value).toLocaleString()}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
