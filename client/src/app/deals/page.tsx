'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAuthToken } from '@/lib/auth-utils';
import { Board } from '@/components/kanban/Board';
import { DealsTable } from '@/components/deals/DealsTable';
import { Plus, LayoutGrid, List, RefreshCw } from 'lucide-react';
import { CreateDealModal } from '@/components/deals/CreateDealModal';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function Deals() {
    const [deals, setDeals] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [userRole, setUserRole] = useState('rep');
    const [userId, setUserId] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'board' | 'list'>('list');

    // Keep a ref to the latest session token so fetchDeals can use it without
    // re-creating the function on every render (avoids stale-closure bugs)
    const tokenRef = useRef<string | null>(null);

    // ── Core fetch ──────────────────────────────────────────────────────────
    const fetchDeals = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);

        try {
            const token = await getAuthToken();
            if (!token) {
                console.error('[Deals] No auth token found');
                return;
            }

            tokenRef.current = token;

            const [meRes, dealsRes] = await Promise.all([
                fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/me`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/deals`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
            ]);

            if (meRes.ok) {
                const me = await meRes.json();
                setUserRole(me.role);
                setUserId(me.user_id || me.id);
            }

            if (dealsRes.ok) {
                const data = await dealsRes.json();
                setDeals(data);
            }
        } catch (err) {
            console.error('Error loading deals:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    // Initial load
    useEffect(() => { fetchDeals(); }, [fetchDeals]);

    // ── Re-fetch server data every time the user switches view ───────────────
    const handleViewChange = useCallback((mode: 'board' | 'list') => {
        if (mode === viewMode) return;
        setViewMode(mode);
        fetchDeals(true); 
    }, [viewMode, fetchDeals]);

    // ── Callback children call after saving a stage/field change ────────────
    const handleDealUpdated = useCallback((dealId: string, patch: Partial<any>) => {
        setDeals(prev =>
            prev.map(d => d.deal_id === dealId ? { ...d, ...patch } : d)
        );
    }, []);

    // ── New deal created ─────────────────────────────────────────────────────
    const handleNewDeal = useCallback((newDeal: any) => {
        setDeals(prev => [newDeal, ...prev]);
    }, []);

    if (loading) return <div className="p-6 text-slate-500">Loading pipeline…</div>;

    return (
        <ProtectedRoute>
            <div className="flex flex-col h-full bg-slate-50">
                {/* ── Header ──────────────────────────────────────────────── */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Sales Pipeline</h1>
                        <p className="text-sm text-slate-500">Manage your active deals and track progress.</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <RefreshCw
                            size={15}
                            className={`text-slate-400 transition-transform ${refreshing ? 'animate-spin' : 'opacity-0'}`}
                        />

                        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                            <button
                                onClick={() => handleViewChange('list')}
                                className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-white shadow text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                                title="List View"
                            >
                                <List size={16} />
                            </button>
                            <button
                                onClick={() => handleViewChange('board')}
                                className={`p-1.5 rounded transition-colors ${viewMode === 'board' ? 'bg-white shadow text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                                title="Kanban Board"
                            >
                                <LayoutGrid size={16} />
                            </button>
                        </div>

                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
                        >
                            <Plus size={16} />
                            {userRole === 'intern' ? 'New Lead' : 'New Deal'}
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden bg-white">
                    {viewMode === 'board' ? (
                        <Board
                            initialDeals={deals}
                            userRole={userRole}
                            userId={userId}
                            onDealUpdated={handleDealUpdated}
                        />
                    ) : (
                        <div className="h-full overflow-y-auto pr-2">
                            <DealsTable
                                deals={deals}
                                userRole={userRole}
                                userId={userId}
                                onDealUpdated={handleDealUpdated}
                            />
                        </div>
                    )}
                </div>

                <CreateDealModal
                    isOpen={isCreateModalOpen}
                    userRole={userRole}
                    onClose={() => setIsCreateModalOpen(false)}
                    onSuccess={handleNewDeal}
                />
            </div>
        </ProtectedRoute>
    );
}
