'use client';
/**
 * FR-D.2 — Lead Score Badge
 *
 * Displays the current 0-100 lead score for a deal.
 * Color-coded: green (high), amber (mid), red (low).
 * Shows a tooltip on hover with the score update time.
 * Can optionally trigger a manual recalculation.
 */
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { TrendingUp, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeadScoreBadgeProps {
    dealId: string;
    initialScore?: number;
    updatedAt?: string | null;
    size?: 'sm' | 'md';
    showLabel?: boolean;
    allowRefresh?: boolean;
}

function scoreColor(score: number) {
    if (score >= 70) return { ring: 'ring-emerald-300', bg: 'bg-emerald-50', text: 'text-emerald-700', bar: 'bg-emerald-500' };
    if (score >= 40) return { ring: 'ring-amber-300', bg: 'bg-amber-50', text: 'text-amber-700', bar: 'bg-amber-500' };
    return { ring: 'ring-red-300', bg: 'bg-red-50', text: 'text-red-700', bar: 'bg-red-500' };
}

export function LeadScoreBadge({
    dealId,
    initialScore = 0,
    updatedAt,
    size = 'sm',
    showLabel = false,
    allowRefresh = false,
}: LeadScoreBadgeProps) {
    const [score, setScore] = useState(initialScore);
    const [ts, setTs] = useState(updatedAt);
    const [loading, setLoading] = useState(false);

    const c = scoreColor(score);

    const handleRefresh = async () => {
        if (!allowRefresh) return;
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/api/deals/${dealId}/score`,
                { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } }
            );
            if (res.ok) {
                const data = await res.json();
                setScore(data.score);
                setTs(data.latestDate);
            }
        } finally { setLoading(false); }
    };

    const scoreLabel = score >= 70 ? 'Hot' : score >= 40 ? 'Warm' : 'Cold';
    const updatedStr = ts
        ? `Updated ${new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
        : 'Not yet calculated';

    return (
        <div
            className={cn(
                'group relative inline-flex items-center gap-1 rounded-full px-2 py-0.5 ring-1',
                c.bg, c.ring,
                size === 'md' ? 'px-3 py-1 gap-1.5' : ''
            )}
            title={updatedStr}
        >
            <TrendingUp
                size={size === 'md' ? 13 : 11}
                className={cn(c.text, 'shrink-0')}
            />
            <span className={cn('font-bold tabular-nums', c.text, size === 'md' ? 'text-sm' : 'text-[11px]')}>
                {score}
            </span>
            {showLabel && (
                <span className={cn('text-[10px] font-medium', c.text)}>{scoreLabel}</span>
            )}
            {allowRefresh && (
                <button
                    onClick={handleRefresh}
                    disabled={loading}
                    className={cn(
                        'ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity',
                        c.text
                    )}
                    title="Recalculate score"
                >
                    <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
                </button>
            )}

            {/* Mini bar (width = score%) */}
            <span
                className={cn('absolute bottom-0 left-0 h-[2px] rounded-full', c.bar)}
                style={{ width: `${score}%` }}
            />
        </div>
    );
}
