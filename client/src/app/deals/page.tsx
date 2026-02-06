'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Board } from '@/components/kanban/Board';
import { Plus } from 'lucide-react';
import { CreateDealModal } from '@/components/deals/CreateDealModal';

export default function Deals() {
    const [deals, setDeals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState('rep'); // Default safe
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

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
        <div className="flex flex-col h-full bg-slate-50">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Sales Pipeline</h1>
                    <p className="text-sm text-slate-500">Manage your active deals and track progress.</p>
                </div>
                <div className="flex items-center gap-4">
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

            <div className="flex-1 overflow-hidden">
                <Board initialDeals={deals} userRole={userRole} />
            </div>

            <CreateDealModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={handleNewDeal}
            />
        </div>
    );
}
