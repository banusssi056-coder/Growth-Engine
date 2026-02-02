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
import { Column } from './Column';
import { DealCard } from './DealCard';

interface Deal {
    deal_id: string;
    name: string;
    company_name: string;
    value: number;
    stage: string;
}

interface BoardProps {
    initialDeals: Deal[];
}

const STAGES = ['Lead', 'Meeting', 'Proposal', 'Closed'];

export function Board({ initialDeals }: BoardProps) {
    const [items, setItems] = useState<Record<string, Deal[]>>({});
    const [activeId, setActiveId] = useState<string | null>(null);

    useEffect(() => {
        // Group deals by stage
        const grouped = STAGES.reduce((acc, stage) => {
            acc[stage] = initialDeals.filter((d) => d.stage === stage);
            return acc;
        }, {} as Record<string, Deal[]>);
        setItems(grouped);
    }, [initialDeals]);

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
                await fetch(`http://localhost:5000/api/deals/${active.id}`, {
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
                    />
                ))}
            </div>
            <DragOverlay dropAnimation={dropAnimation}>
                {activeId ? (() => {
                    const activeDeal = Object.values(items).flat().find(d => d.deal_id === activeId);
                    return activeDeal ? <DealCard deal={activeDeal} /> : null;
                })() : null}
            </DragOverlay>
        </DndContext>
    );
}
