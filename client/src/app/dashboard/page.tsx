'use client';
import { useEffect, useState } from 'react';
import { Board } from '@/components/kanban/Board';

export default function Dashboard() {
    const [deals, setDeals] = useState([]);
    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
        // 1. Fetch Deals
        fetch('http://localhost:5000/api/deals')
            .then(res => {
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
                setDeals([]); // Graceful fallback
            });

        // 2. Fetch Stats
        fetch('http://localhost:5000/api/dashboard/stats')
            .then(res => res.json())
            .then(data => setStats(data.summary))
            .catch(err => console.error("Failed to fetch stats", err));
    }, []);

    return (
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
                            ${stats?.total_pipeline_value ? Number(stats.total_pipeline_value).toLocaleString() : '0.00'}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-slate-500">Weighted Forecast</div>
                        <div className="text-xl font-bold text-emerald-600">
                            ${stats?.expected_revenue ? Number(stats.expected_revenue).toLocaleString() : '0.00'}
                        </div>
                    </div>
                </div>
            </header>

            {/* Kanban Board */}
            <main className="flex-1 overflow-hidden p-6">
                <Board initialDeals={deals} />
            </main>
        </div>
    );
}
