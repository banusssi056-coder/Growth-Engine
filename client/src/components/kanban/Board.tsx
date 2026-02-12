'use client';
import React, { useState, useEffect } from 'react';
import {
    DndContext,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
    DragStartEvent,
    DragOverEvent,
    DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { DealCard } from './DealCard'; // Only DealCard needed for overlay
import { Column } from './Column';

interface Deal {
    deal_id: string;
    name: string;
    company_name: string;
    value: number;
    stage: string;
    level?: string;
    offering?: string;
    priority?: number;
    frequency?: string;
    remark?: string;
}

interface BoardProps {
    initialDeals: Deal[];
    userRole: string;
}

const STAGES = [
    '1- New Lead',
    '2- Discussing, RFQing',
    '3- Presenting, Quoting',
    '4- Negotiating, Closing',
    '5- WIP',
    '6- Invoice, Payment pending',
    '7- Hold',
    '8- Paid',
    '9- Lost'
];

export function Board({ initialDeals, userRole }: BoardProps) {
    const [items, setItems] = useState<Record<string, Deal[]>>({});
    const [activeId, setActiveId] = useState<string | null>(null);

    useEffect(() => {
        if (!initialDeals) return;

        // Group deals by stage
        const grouped = STAGES.reduce((acc, stage) => {
            // Strictly filter deals with valid IDs and correct stage
            acc[stage] = initialDeals.filter((d) => d && d.deal_id && d.stage === stage);
            return acc;
        }, {} as Record<string, Deal[]>);

        console.log("Board Initialized with items:", Object.keys(grouped).map(k => `${k}: ${grouped[k].length}`));
        setItems(grouped);
    }, [initialDeals]);

    // Disable sensors if Intern
    const isDragEnabled = userRole !== 'intern';

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const findContainer = (id: string) => {
        if (id in items) return id;

        return Object.keys(items).find((key) =>
            items[key].find((item) => item.deal_id === id)
        );
    };

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        setActiveId(active.id as string);
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        const overId = over?.id;

        if (!overId || active.id === overId) return;

        const activeContainer = findContainer(active.id as string);
        const overContainer = findContainer(overId as string);

        if (!activeContainer || !overContainer || activeContainer === overContainer) {
            return;
        }

        setItems((prev) => {
            const activeItems = prev[activeContainer];
            const overItems = prev[overContainer];
            const activeIndex = activeItems.findIndex((i) => i.deal_id === active.id);
            const overIndex = overItems.findIndex((i) => i.deal_id === overId);

            let newIndex;
            if (overId in prev) {
                newIndex = overItems.length + 1;
            } else {
                const isBelowOverItem =
                    over &&
                    active.rect.current.translated &&
                    active.rect.current.translated.top >
                    over.rect.top + over.rect.height;

                const modifier = isBelowOverItem ? 1 : 0;
                newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length + 1;
            }

            return {
                ...prev,
                [activeContainer]: [
                    ...prev[activeContainer].filter((item) => item.deal_id !== active.id),
                ],
                [overContainer]: [
                    ...prev[overContainer].slice(0, newIndex),
                    items[activeContainer][activeIndex],
                    ...prev[overContainer].slice(newIndex, prev[overContainer].length),
                ],
            };
        });
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        const activeContainer = findContainer(active.id as string);
        const overContainer = findContainer(over?.id as string);

        if (
            !activeContainer ||
            !overContainer ||
            (activeContainer === overContainer && active.id === over?.id)
        ) {
            setActiveId(null);
            return;
        }

        // API Call to update stage
        if (activeContainer !== overContainer) {
            try {
                // Optimistic update already happened in DragOver mostly, but let's confirm placement
                // In a real app we would call API here
                await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/deals/${active.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ stage: overContainer }) // Target stage is the new container key
                });
            } catch (err) {
                console.error("Failed to update deal stage", err);
                // Revert state if needed (not implemented for simplicity)
            }
        }

        setItems((prev) => {
            // Final reordering if needed within same column
            // Omitted for brevity as DragOver handles the bulk of it
            return prev;
        });

        setActiveId(null);
    };

    const dropAnimation = {
        sideEffects: defaultDropAnimationSideEffects({
            styles: {
                active: { opacity: '0.5' },
            },
        }),
    };

    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    // Log Activity State
    const [loggingDealId, setLoggingDealId] = useState<string | null>(null);
    const [activityType, setActivityType] = useState('NOTE');
    const [activityContent, setActivityContent] = useState('');

    const handleLogActivity = async () => {
        if (!loggingDealId || !activityContent) return;

        // Dynamic import to avoid SSR issues if needed, or just standard fetch
        const { supabase } = await import('../../lib/supabase'); // Lazy load client
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/activities`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    deal_id: loggingDealId,
                    type: activityType,
                    content: activityContent
                })
            });
            // Reset
            setLoggingDealId(null);
            setActivityContent('');
        }
    };

    if (!mounted) return null;

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="flex h-full w-full gap-4 overflow-x-auto p-4">
                {STAGES.map((stage) => (
                    <Column
                        key={stage}
                        id={stage}
                        title={stage}
                        deals={items[stage] || []}
                        onLogActivity={setLoggingDealId}
                    />
                ))}
            </div>
            <DragOverlay dropAnimation={dropAnimation}>
                {activeId ? (() => {
                    const activeDeal = Object.values(items).flat().find(d => d.deal_id === activeId);
                    return activeDeal ? <DealCard deal={activeDeal} isOverlay={true} /> : null;
                })() : null}
            </DragOverlay>

            {/* Log Activity Modal */}
            {loggingDealId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
                        <h2 className="mb-4 text-xl font-bold text-slate-900">Log Activity</h2>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700">Type</label>
                            <select
                                value={activityType}
                                onChange={(e) => setActivityType(e.target.value)}
                                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            >
                                <option value="NOTE">Note</option>
                                <option value="CALL">Call</option>
                                <option value="EMAIL">Email</option>
                                <option value="MEETING">Meeting</option>
                            </select>
                        </div>
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-slate-700">Details</label>
                            <textarea
                                value={activityContent}
                                onChange={(e) => setActivityContent(e.target.value)}
                                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                rows={3}
                                placeholder="What happened?"
                            />
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setLoggingDealId(null)}
                                className="rounded-md px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleLogActivity}
                                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                            >
                                Save Log
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DndContext>
    );
}
