'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DealsTable } from '@/components/deals/DealsTable';
import { supabase } from '../../lib/supabase';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { formatCurrency } from '@/lib/currency';

export default function Dashboard() {
    const [deals, setDeals] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [userRole, setUserRole] = useState<string>('rep');
    const router = useRouter();

    useEffect(() => {
        const checkAuthAndFetch = async () => {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                router.push('/login');
                return;
            }

            const token = session.access_token;
            const headers = {
                'Authorization': `Bearer ${token}`
            };

            // 0. Fetch User Role
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/me`, { headers })
                .then(res => res.json())
                .then(user => setUserRole(user.role))
                .catch(err => console.error("Failed to fetch user:", err));

            // 1. Fetch Deals
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/deals`, { headers })
                .then(res => {
                    if (res.status === 401 || res.status === 403) {
                        router.push('/login');
                        throw new Error("Unauthorized");
                    }
                    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                    return res.json();
                })
                .then(data => {
                    if (Array.isArray(data)) {
                        setDeals(data);
                    } else {
                        console.error("Invalid deals response:", data);
                        setDeals([]);
                    }
                })
                .catch(err => {
                    console.error("Failed to fetch deals:", err);
                    if (err.message !== "Unauthorized") setDeals([]);
                });

            // 2. Fetch Stats
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/dashboard/stats`, { headers })
                .then(res => res.json())
                .then(data => setStats(data.summary))
                .catch(err => console.error("Failed to fetch stats", err));
        };

        checkAuthAndFetch();
    }, [router]);

    return (
        <ProtectedRoute>
            <div className="h-full flex flex-col overflow-hidden bg-slate-100">
                {/* Header Stats */}
                <header className="flex-none bg-white border-b border-slate-200 px-6 py-8 flex justify-between items-center bg-gradient-to-r from-white to-slate-50">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Executive Dashboard</h1>
                        <p className="text-slate-500 font-medium mt-1">Real-time overview of your sales ecosystem performance.</p>
                    </div>
                    <div className="flex gap-12">
                        <div className="text-right">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 px-1">Total Pipeline</div>
                            <div className="text-3xl font-black text-slate-900 tracking-tighter">
                                {formatCurrency(stats?.total_pipeline_value)}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-1 px-1 underline decoration-emerald-200 decoration-2 underline-offset-4">Weighted Forecast</div>
                            <div className="text-3xl font-black text-emerald-600 tracking-tighter shadow-emerald-100 drop-shadow-sm">
                                {formatCurrency(stats?.expected_revenue)}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Kanban Board */}
                <main className="flex-1 p-2 md:p-6 mb-10 overflow-y-auto custom-scrollbar">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <DealsTable
                            deals={deals}
                            userRole={userRole}
                            onDealUpdated={(id, patch) => {
                                setDeals(prev => prev.map(d => d.deal_id === id ? { ...d, ...patch } : d));
                            }}
                        />
                    </div>
                </main>
            </div>
        </ProtectedRoute>
    );
}
