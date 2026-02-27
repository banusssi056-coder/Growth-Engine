'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { formatCurrency } from '@/lib/currency';
import { TrendingUp, Users, DollarSign, CheckCircle } from 'lucide-react';

export default function PerformancePage() {
    const [analytics, setAnalytics] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const fetchAnalytics = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push('/login');
                return;
            }

            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/analytics/team`, {
                    headers: { 'Authorization': `Bearer ${session.access_token}` }
                });
                if (!res.ok) throw new Error("Failed to fetch analytics");
                const data = await res.json();
                setAnalytics(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
    }, [router]);

    if (loading) {
        return <div className="p-8 text-center">Loading team performance...</div>;
    }

    // Calculate totals for the summary cards
    const totals = analytics.reduce((acc, curr) => ({
        totalDeals: acc.totalDeals + parseInt(curr.total_deals || 0),
        totalPipeline: acc.totalPipeline + parseFloat(curr.total_pipeline || 0),
        weightedForecast: acc.weightedForecast + parseFloat(curr.weighted_forecast || 0),
        closedDeals: acc.closedDeals + parseInt(curr.closed_deals || 0)
    }), { totalDeals: 0, totalPipeline: 0, weightedForecast: 0, closedDeals: 0 });

    return (
        <ProtectedRoute>
            <div className="h-full flex flex-col overflow-hidden bg-slate-50">
                <header className="flex-none bg-white border-b border-slate-200 px-8 py-6">
                    <h1 className="text-2xl font-bold text-slate-800">Team Performance</h1>
                    <p className="text-sm text-slate-500">Analytics and metrics for your direct reports.</p>
                </header>

                <main className="flex-1 overflow-y-auto p-8">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                    <Users size={20} />
                                </div>
                                <span className="text-sm font-medium text-slate-500">Active Deals</span>
                            </div>
                            <div className="text-2xl font-bold text-slate-900">{totals.totalDeals}</div>
                        </div>

                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                                    <TrendingUp size={20} />
                                </div>
                                <span className="text-sm font-medium text-slate-500">Weighted Forecast</span>
                            </div>
                            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(totals.weightedForecast)}</div>
                        </div>

                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                                    <DollarSign size={20} />
                                </div>
                                <span className="text-sm font-medium text-slate-500">Total Pipeline</span>
                            </div>
                            <div className="text-2xl font-bold text-amber-600">{formatCurrency(totals.totalPipeline)}</div>
                        </div>

                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                                    <CheckCircle size={20} />
                                </div>
                                <span className="text-sm font-medium text-slate-500">Closed Wins</span>
                            </div>
                            <div className="text-2xl font-bold text-purple-600">{totals.closedDeals}</div>
                        </div>
                    </div>

                    {/* Team Table */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    <th className="px-6 py-4">Sales Representative</th>
                                    <th className="px-6 py-4 text-center">Deals</th>
                                    <th className="px-6 py-4 text-right">Pipeline Value</th>
                                    <th className="px-6 py-4 text-right">Weighted Forecast</th>
                                    <th className="px-6 py-4 text-center">Closed Wins</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {analytics.map((rep) => (
                                    <tr key={rep.rep_name} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                                                    {rep.rep_name.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="font-medium text-slate-800">{rep.rep_name.split('@')[0]}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center font-medium text-slate-600">{rep.total_deals}</td>
                                        <td className="px-6 py-4 text-right font-medium text-slate-900">{formatCurrency(rep.total_pipeline)}</td>
                                        <td className="px-6 py-4 text-right font-bold text-emerald-600">{formatCurrency(rep.weighted_forecast)}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                                {rep.closed_deals}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </main>
            </div>
        </ProtectedRoute>
    );
}
