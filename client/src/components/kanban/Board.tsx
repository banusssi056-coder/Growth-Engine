'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
    DndContext, closestCorners, KeyboardSensor, PointerSensor,
    useSensor, useSensors, DragOverlay, defaultDropAnimationSideEffects,
    DragStartEvent, DragOverEvent, DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { DealCard } from './DealCard';
import { Column } from './Column';
import { ActivityLogPanel } from './ActivityLogPanel';
import { supabase } from '../../lib/supabase';
import { Loader2 } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Deal {
    deal_id: string;
    name: string;
    company_name: string;
    value: number;
    stage: string;
    probability?: number;
    level?: string;
    offering?: string;
    priority?: number;
    frequency?: string;
    remark?: string;
}

interface StageConfig {
    stage_id: string;
    name: string;
    color: string;
    position: number;
    probability: number;
}

interface BoardProps {
    initialDeals: Deal[];
    userRole: string;
    onDealUpdated?: (dealId: string, patch: Partial<Deal>) => void;
}

// ── Board ─────────────────────────────────────────────────────────────────────
export function Board({ initialDeals, userRole, onDealUpdated }: BoardProps) {
    // ── Stage config (from DB) ────────────────────────────────────────────────
    const [stageConfigs, setStageConfigs] = useState<StageConfig[]>([]);
    const [stagesLoading, setStagesLoading] = useState(true);

    // Build lookup maps from stage configs
    const stageNames = stageConfigs.map(s => s.name);
    const stageProbability: Record<string, number> = Object.fromEntries(
        stageConfigs.map(s => [s.name, s.probability])
    );

    // Fetch stages from DB (FR-B.1 customizable stages)
    const fetchStages = useCallback(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stages`, {
                headers: { Authorization: `Bearer ${session.access_token}` }
            });
            if (res.ok) {
                const data: StageConfig[] = await res.json();
                setStageConfigs(data);
            } else {
                // Fallback to hardcoded stages if table doesn't exist yet
                setStageConfigs(FALLBACK_STAGES);
            }
        } catch {
            setStageConfigs(FALLBACK_STAGES);
        } finally {
            setStagesLoading(false);
        }
    }, []);

    useEffect(() => { fetchStages(); }, [fetchStages]);

    // ── Board items (grouped by stage) ────────────────────────────────────────
    const [items, setItems] = useState<Record<string, Deal[]>>({});
    const [activeId, setActiveId] = useState<string | null>(null);
    const [startContainer, setStartContainer] = useState<string | null>(null);

    useEffect(() => {
        if (!initialDeals || stageNames.length === 0) return;
        const grouped = stageNames.reduce((acc, stage) => {
            acc[stage] = initialDeals.filter(d => d && d.deal_id && d.stage === stage);
            return acc;
        }, {} as Record<string, Deal[]>);
        setItems(grouped);
    }, [initialDeals, stageNames.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── DnD sensors ──────────────────────────────────────────────────────────
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const findContainer = (id: string) => {
        if (id in items) return id;
        return Object.keys(items).find(key => items[key].find(item => item.deal_id === id));
    };

    const handleDragStart = ({ active }: DragStartEvent) => {
        setActiveId(active.id as string);
        setStartContainer(findContainer(active.id as string) ?? null);
    };

    const handleDragOver = ({ active, over }: DragOverEvent) => {
        const overId = over?.id;
        if (!overId || active.id === overId) return;

        const activeContainer = findContainer(active.id as string);
        const overContainer = findContainer(overId as string);

        if (!activeContainer || !overContainer || activeContainer === overContainer) return;

        setItems(prev => {
            const activeItems = prev[activeContainer];
            const overItems = prev[overContainer];
            const activeIndex = activeItems.findIndex(i => i.deal_id === active.id);
            const overIndex = overItems.findIndex(i => i.deal_id === overId);

            let newIndex: number;
            if (overId in prev) {
                newIndex = overItems.length + 1;
            } else {
                const isBelowOverItem = over &&
                    active.rect.current.translated &&
                    active.rect.current.translated.top > over.rect.top + over.rect.height;
                const modifier = isBelowOverItem ? 1 : 0;
                newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length + 1;
            }

            return {
                ...prev,
                [activeContainer]: prev[activeContainer].filter(item => item.deal_id !== active.id),
                [overContainer]: [
                    ...prev[overContainer].slice(0, newIndex),
                    items[activeContainer][activeIndex],
                    ...prev[overContainer].slice(newIndex),
                ],
            };
        });
    };

    const handleDragEnd = async ({ active, over }: DragEndEvent) => {
        const activeContainer = findContainer(active.id as string);
        const overContainer = findContainer(over?.id as string);

        if (!activeContainer || !overContainer ||
            (activeContainer === overContainer && active.id === over?.id)) {
            setActiveId(null); setStartContainer(null); return;
        }

        // Only persist if stage actually changed
        if (startContainer && activeContainer !== startContainer) {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) { console.error('No session'); return; }

                const response = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL}/api/deals/${active.id}`,
                    {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`
                        },
                        body: JSON.stringify({
                            stage: activeContainer,
                            probability: stageProbability[activeContainer] ?? 10
                        })
                    }
                );

                if (!response.ok) {
                    console.error('Failed to update deal stage', await response.text());
                    // Roll back optimistic update
                    setItems(prev => {
                        const deal = prev[activeContainer]?.find(d => d.deal_id === active.id);
                        if (!deal || !startContainer) return prev;
                        return {
                            ...prev,
                            [activeContainer]: prev[activeContainer].filter(d => d.deal_id !== active.id),
                            [startContainer]: [deal, ...(prev[startContainer] || [])],
                        };
                    });
                } else {
                    // Notify parent so list view also updates
                    onDealUpdated?.(active.id as string, {
                        stage: activeContainer,
                        probability: stageProbability[activeContainer] ?? 10
                    });
                }
            } catch (err) {
                console.error('Failed to update deal stage', err);
            }
        }

        setActiveId(null);
        setStartContainer(null);
    };

    const dropAnimation = {
        sideEffects: defaultDropAnimationSideEffects({
            styles: { active: { opacity: '0.5' } },
        }),
    };

    // ── Activity log panel ────────────────────────────────────────────────────
    const [activityDeal, setActivityDeal] = useState<{ id: string; name: string } | null>(null);

    const handleOpenActivityLog = useCallback((dealId: string, dealName: string) => {
        setActivityDeal({ id: dealId, name: dealName });
    }, []);

    // ── Hydration guard ───────────────────────────────────────────────────────
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    if (!mounted || stagesLoading) {
        return (
            <div className="flex h-full items-center justify-center gap-2 text-slate-400">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-sm">Loading board…</span>
            </div>
        );
    }

    return (
        <>
            <DndContext
                sensors={userRole === 'intern' ? [] : sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
            >
                <div className="flex h-full w-full gap-4 overflow-x-auto p-2 pb-4">
                    {stageConfigs.map((stage) => (
                        <Column
                            key={stage.stage_id}
                            id={stage.name}
                            title={stage.name}
                            color={stage.color}
                            deals={items[stage.name] || []}
                            onLogActivity={(dealId) => {
                                const deal = (items[stage.name] || []).find(d => d.deal_id === dealId);
                                if (deal) handleOpenActivityLog(deal.deal_id, deal.name);
                            }}
                        />
                    ))}
                </div>

                <DragOverlay dropAnimation={dropAnimation}>
                    {activeId ? (() => {
                        const activeDeal = Object.values(items).flat().find(d => d.deal_id === activeId);
                        return activeDeal ? <DealCard deal={activeDeal} isOverlay={true} /> : null;
                    })() : null}
                </DragOverlay>
            </DndContext>

            {/* Activity Log slide-in panel */}
            {activityDeal && (
                <ActivityLogPanel
                    dealId={activityDeal.id}
                    dealName={activityDeal.name}
                    onClose={() => setActivityDeal(null)}
                />
            )}
        </>
    );
}

// ── Fallback hardcoded stages (used if stages table hasn't been created yet) ──
const FALLBACK_STAGES: StageConfig[] = [
    { stage_id: '1', name: '1- New Lead', color: '#3b82f6', position: 1, probability: 10 },
    { stage_id: '2', name: '2- Discussing, RFQing', color: '#f59e0b', position: 2, probability: 20 },
    { stage_id: '3', name: '3- Presenting, Quoting', color: '#f59e0b', position: 3, probability: 40 },
    { stage_id: '4', name: '4- Negotiating, Closing', color: '#f59e0b', position: 4, probability: 60 },
    { stage_id: '5', name: '5- WIP', color: '#f59e0b', position: 5, probability: 80 },
    { stage_id: '6', name: '6- Invoice, Payment pending', color: '#f59e0b', position: 6, probability: 90 },
    { stage_id: '7', name: '7- Hold', color: '#94a3b8', position: 7, probability: 10 },
    { stage_id: '8', name: '8- Paid', color: '#10b981', position: 8, probability: 100 },
    { stage_id: '9', name: '9- Lost', color: '#ef4444', position: 9, probability: 0 },
];
