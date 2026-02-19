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
                <header className="flex-none bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Sales Pipeline</h1>
                        <p className="text-sm text-slate-500">Manage your active deals and track progress.</p>
                    </div>
                    <div className="flex gap-6">
                        <div className="text-right">
                            <div className="text-sm text-slate-500">Total Pipeline</div>
                            <div className="text-xl font-bold text-slate-900">
                                {formatCurrency(stats?.total_pipeline_value)}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm text-slate-500">Weighted Forecast</div>
                            <div className="text-xl font-bold text-emerald-600">
                                {formatCurrency(stats?.expected_revenue)}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Kanban Board */}
                <main className="flex-1 overflow-y-auto p-6">
                    <DealsTable deals={deals} />
                </main>
            </div>
        </ProtectedRoute>
    );
}
