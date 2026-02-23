'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { X, ArrowRightLeft, MessageSquare, Phone, Mail, Users, CheckCircle2, Loader2, Eye, MousePointerClick, Send } from 'lucide-react';
import { EmailComposer } from '@/components/deals/EmailComposer';
import { LeadScoreBadge } from '@/components/deals/LeadScoreBadge';

interface Activity {
    act_id: string;
    type: 'CALL' | 'EMAIL' | 'NOTE' | 'MEETING' | 'SYSTEM' | 'STAGE_CHANGE';
    content: string;
    actor_email?: string;
    actor_name?: string;
    occurred_at: string;
}

interface ActivityLogPanelProps {
    dealId: string;
    dealName: string;
    score?: number;
    onClose: () => void;
}

const TYPE_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
    STAGE_CHANGE: { icon: ArrowRightLeft, color: 'text-emerald-600 bg-emerald-50', label: 'Stage Change' },
    NOTE: { icon: MessageSquare, color: 'text-slate-600  bg-slate-100', label: 'Note' },
    CALL: { icon: Phone, color: 'text-blue-600   bg-blue-50', label: 'Call' },
    EMAIL: { icon: Mail, color: 'text-violet-600 bg-violet-50', label: 'Email' },
    EMAIL_SENT: { icon: Send, color: 'text-violet-600 bg-violet-50', label: 'Email Sent' },
    EMAIL_OPENED: { icon: Eye, color: 'text-emerald-600 bg-emerald-50', label: 'Email Opened' },
    LINK_CLICKED: { icon: MousePointerClick, color: 'text-blue-600  bg-blue-50', label: 'Link Clicked' },
    MEETING: { icon: Users, color: 'text-amber-600  bg-amber-50', label: 'Meeting' },
    SYSTEM: { icon: CheckCircle2, color: 'text-rose-600   bg-rose-50', label: 'System' },
    ALERT: { icon: CheckCircle2, color: 'text-orange-600 bg-orange-50', label: 'Alert' },
};

function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60_000);
    const hr = Math.floor(diff / 3_600_000);
    const day = Math.floor(diff / 86_400_000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min}m ago`;
    if (hr < 24) return `${hr}h ago`;
    return `${day}d ago`;
}

export function ActivityLogPanel({ dealId, dealName, score = 0, onClose }: ActivityLogPanelProps) {
    const [tab, setTab] = useState<'log' | 'email'>('log');
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchActivities = useCallback(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/api/deals/${dealId}/activities`,
                { headers: { Authorization: `Bearer ${session.access_token}` } }
            );
            if (res.ok) setActivities(await res.json());
        } catch (e) {
            console.error('[ActivityLog] fetch error', e);
        } finally {
            setLoading(false);
        }
    }, [dealId]);

    useEffect(() => { fetchActivities(); }, [fetchActivities]);

    const addNote = async () => {
        const content = note.trim();
        if (!content) return;
        setSaving(true);
        setError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/activities`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ deal_id: dealId, type: 'NOTE', content })
            });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
            setNote('');
            await fetchActivities();
        } catch (e: any) {
            setError(e.message || 'Failed to add note');
        } finally {
            setSaving(false);
        }
    };

    return (
        /* Slide-in panel from right */
        <div
            className="fixed inset-0 z-50 flex items-stretch justify-end"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

            {/* Panel */}
            <div className="relative z-10 flex flex-col w-full max-w-md bg-white shadow-2xl animate-slide-in-right">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
                    <div>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">Deal Panel</p>
                        <div className="flex items-center gap-2 mt-0.5">
                            <h2 className="text-sm font-bold text-slate-800 truncate max-w-[220px]">{dealName}</h2>
                            <LeadScoreBadge dealId={dealId} initialScore={score} showLabel allowRefresh />
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Tab switcher */}
                <div className="flex border-b border-slate-100">
                    <button
                        onClick={() => setTab('log')}
                        className={`flex-1 py-2 text-xs font-medium transition-colors ${tab === 'log'
                                ? 'border-b-2 border-emerald-500 text-emerald-700 bg-emerald-50/50'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Activity Log
                    </button>
                    <button
                        onClick={() => setTab('email')}
                        className={`flex-1 py-2 text-xs font-medium transition-colors ${tab === 'email'
                                ? 'border-b-2 border-violet-500 text-violet-700 bg-violet-50/50'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <span className="flex items-center justify-center gap-1">
                            <Mail size={11} /> Email + Track
                        </span>
                    </button>
                </div>

                {tab === 'email' ? (
                    <div className="flex-1 overflow-y-auto p-4">
                        <EmailComposer dealId={dealId} />
                    </div>
                ) : (
                    <>
                        {/* Add Note */}
                        <div className="px-5 py-3 border-b border-slate-100 bg-white">
                            <div className="flex gap-2 items-end">
                                <textarea
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNote(); }
                                    }}
                                    placeholder="Add a note… (Enter to save, Shift+Enter for newline)"
                                    rows={2}
                                    className="flex-1 resize-none rounded-lg border border-slate-200 text-xs px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder:text-slate-300"
                                />
                                <button
                                    onClick={addNote}
                                    disabled={saving || !note.trim()}
                                    className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                >
                                    {saving ? <Loader2 size={12} className="animate-spin" /> : <MessageSquare size={12} />}
                                    Save
                                </button>
                            </div>
                            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
                        </div>

                        {/* Feed */}
                        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 size={20} className="animate-spin text-slate-400" />
                                </div>
                            ) : activities.length === 0 ? (
                                <div className="text-center py-12">
                                    <ArrowRightLeft size={28} className="mx-auto text-slate-300 mb-2" />
                                    <p className="text-xs text-slate-400">No activity yet.<br />Move this deal to record the first entry.</p>
                                </div>
                            ) : (
                                activities.map((a) => {
                                    const meta = TYPE_META[a.type] || TYPE_META.NOTE;
                                    const Icon = meta.icon;
                                    return (
                                        <div key={a.act_id} className="flex gap-3">
                                            {/* Icon dot */}
                                            <div className={`shrink-0 mt-0.5 w-7 h-7 rounded-full flex items-center justify-center ${meta.color}`}>
                                                <Icon size={13} />
                                            </div>
                                            {/* Body */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2 mb-0.5">
                                                    <span className={`text-[10px] font-bold uppercase tracking-widest ${meta.color.split(' ')[0]}`}>
                                                        {meta.label}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 shrink-0">{timeAgo(a.occurred_at)}</span>
                                                </div>
                                                <p className="text-xs text-slate-700 leading-relaxed break-words">{a.content}</p>
                                                {(a.actor_name || a.actor_email) && (
                                                    <p className="mt-0.5 text-[10px] text-slate-400">
                                                        by {a.actor_name || a.actor_email}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </>)}
            </div>

            <style>{`
                @keyframes slide-in-right {
                    from { transform: translateX(100%); opacity: 0; }
                    to   { transform: translateX(0);    opacity: 1; }
                }
                .animate-slide-in-right {
                    animation: slide-in-right 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
                }
            `}</style>
        </div>
    );
}
