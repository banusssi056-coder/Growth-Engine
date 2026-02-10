'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const Board = dynamic(() => import('@/components/kanban/Board').then(mod => mod.Board), {
    ssr: false,
    loading: () => <div className="p-8 text-slate-500">Loading pipeline...</div>
});
import { supabase } from '../../../lib/supabase';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function ManagerDashboard() {
    const [deals, setDeals] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [userRole, setUserRole] = useState<string>('manager');
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

            // Fetch User Role
            try {
                const userRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/me`, { headers });
                if (userRes.ok) {
                    const user = await userRes.json();
                    setUserRole(user.role);

                    // Manager or Admin only
                    if (user.role !== 'manager' && user.role !== 'admin') {
                        router.push('/dashboard'); // Redirect non-managers to regular dashboard
                        return;
                    }
                }
            } catch (err) {
                console.error("Failed to fetch user:", err);
            }

            // Fetch Team Deals (manager sees their team's deals)
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

            // Fetch Stats
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
                <header className="flex-none bg-gradient-to-r from-blue-600 to-blue-700 border-b border-blue-800 px-6 py-4 flex justify-between items-center">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-white">Manager Dashboard</h1>
                            <span className="px-3 py-1 bg-blue-500 text-white text-xs font-semibold rounded-full">
                                Team View
                            </span>
                        </div>
                        <p className="text-sm text-blue-100 mt-1">Monitor and manage your team's pipeline</p>
                    </div>
                    <div className="flex gap-6">
                        <div className="text-right">
                            <div className="text-sm text-blue-200">Team Pipeline</div>
                            <div className="text-xl font-bold text-white">
                                ${stats?.total_pipeline_value ? Number(stats.total_pipeline_value).toLocaleString() : '0.00'}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm text-blue-200">Team Forecast</div>
                            <div className="text-xl font-bold text-emerald-300">
                                ${stats?.expected_revenue ? Number(stats.expected_revenue).toLocaleString() : '0.00'}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Kanban Board */}
                <main className="flex-1 overflow-hidden p-6">
                    <Board initialDeals={deals} userRole={userRole} />
                </main>
            </div>
        </ProtectedRoute>
    );
}
