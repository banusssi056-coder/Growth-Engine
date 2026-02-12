'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Board } from '@/components/kanban/Board';
import { DealsTable } from '@/components/deals/DealsTable';
import { Plus, LayoutGrid, List } from 'lucide-react';
import { CreateDealModal } from '@/components/deals/CreateDealModal';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function Deals() {
    const [deals, setDeals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState('rep'); // Default safe
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'board' | 'list'>('list');

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                // Fetch User Role first (could be optimized with context)
                try {
                    const meRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/me`, {
                        headers: { 'Authorization': `Bearer ${session.access_token}` }
                    });
                    if (meRes.ok) {
                        const me = await meRes.json();
                        setUserRole(me.role);
                    }

                    // Fetch Deals
                    const dealsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/deals`, {
                        headers: { 'Authorization': `Bearer ${session.access_token}` }
                    });
                    if (dealsRes.ok) {
                        const data = await dealsRes.json();
                        setDeals(data);
                    }
                } catch (err) {
                    console.error("Error loading deals", err);
                }
            }
            setLoading(false);
        };

        init();
    }, []);

    const handleNewDeal = (newDeal: any) => {
        // Optimistic add or refetch
        setDeals(prev => [newDeal, ...prev] as any);
    };

    if (loading) return <div className="p-6 text-slate-500">Loading pipeline...</div>;

    return (
        <ProtectedRoute>
            <div className="flex flex-col h-full bg-slate-50">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Sales Pipeline</h1>
                        <p className="text-sm text-slate-500">Manage your active deals and track progress.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-white shadow text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                                title="List View"
                            >
                                <List size={16} />
                            </button>
                            <button
                                onClick={() => setViewMode('board')}
                                className={`p-1.5 rounded transition-colors ${viewMode === 'board' ? 'bg-white shadow text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                                title="Kanban Board"
                            >
                                <LayoutGrid size={16} />
                            </button>
                        </div>
                        <div className="text-right hidden sm:block">
                            <p className="text-xs text-slate-500">Total Pipeline</p>
                            <p className="font-bold text-slate-800">
                                ${deals.reduce((acc, d: any) => acc + Number(d.value), 0).toLocaleString()}
                            </p>
                        </div>
                        {userRole !== 'intern' && (
                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
                            >
                                <Plus size={16} />
                                New Deal
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-hidden p-4 bg-slate-50">
                    {viewMode === 'board' ? (
                        <Board initialDeals={deals} userRole={userRole} />
                    ) : (
                        <div className="h-full overflow-y-auto pr-2">
                            <DealsTable deals={deals} />
                        </div>
                    )}
                </div>

                <CreateDealModal
                    isOpen={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                    onSuccess={handleNewDeal}
                />
            </div>
        </ProtectedRoute>
    );
}
