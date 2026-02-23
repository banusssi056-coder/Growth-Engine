'use client';
/**
 * FR-C.2 — In-App Notification Bell
 *
 * Shows a red badge with unread count.
 * On click → opens a slide-down panel listing all notifications.
 * Each notification can be marked read. "Mark all read" button included.
 *
 * Polls every 60 seconds so owners see stale/cold-pool alerts soon
 * after the background job fires.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Bell, X, AlertTriangle, Snowflake, Workflow, Info, CheckCheck, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Notification {
    notif_id: string;
    type: 'STALE_ALERT' | 'COLD_POOL' | 'WORKFLOW' | 'INFO';
    title: string;
    body: string | null;
    deal_name: string | null;
    is_read: boolean;
    created_at: string;
}

const TYPE_META: Record<string, { Icon: React.ElementType; color: string; bg: string }> = {
    STALE_ALERT: { Icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50' },
    COLD_POOL: { Icon: Snowflake, color: 'text-blue-500', bg: 'bg-blue-50' },
    WORKFLOW: { Icon: Workflow, color: 'text-violet-500', bg: 'bg-violet-50' },
    INFO: { Icon: Info, color: 'text-slate-500', bg: 'bg-slate-100' },
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

export function NotificationBell() {
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unread, setUnread] = useState(0);
    const [loading, setLoading] = useState(false);
    const [marking, setMarking] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    const fetchNotifications = useCallback(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/api/notifications`,
                { headers: { Authorization: `Bearer ${session.access_token}` } }
            );
            if (!res.ok) return;
            const data = await res.json();
            setNotifications(data.notifications || []);
            setUnread(data.unread_count || 0);
        } catch { /* silent */ }
    }, []);

    // Initial fetch + 60-second polling
    useEffect(() => {
        fetchNotifications();
        const id = setInterval(fetchNotifications, 60_000);
        return () => clearInterval(id);
    }, [fetchNotifications]);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        if (open) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const markRead = async (id: string) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notifications/${id}/read`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${session.access_token}` }
            });
            setNotifications(ns => ns.map(n => n.notif_id === id ? { ...n, is_read: true } : n));
            setUnread(u => Math.max(0, u - 1));
        } catch { /* silent */ }
    };

    const markAllRead = async () => {
        setMarking(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notifications/read-all`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${session.access_token}` }
            });
            setNotifications(ns => ns.map(n => ({ ...n, is_read: true })));
            setUnread(0);
        } catch { /* silent */ }
        finally { setMarking(false); }
    };

    return (
        <div className="relative" ref={panelRef}>
            {/* Bell button */}
            <button
                id="notification-bell"
                onClick={() => { setOpen(o => !o); if (!open) fetchNotifications(); }}
                className="relative p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                title="Notifications"
            >
                <Bell size={20} />
                {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none animate-pulse">
                        {unread > 99 ? '99+' : unread}
                    </span>
                )}
            </button>

            {/* Drop-down panel */}
            {open && (
                <div
                    className="absolute left-0 top-full mt-2 w-96 bg-white/95 backdrop-blur-xl rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-200 z-50 overflow-hidden"
                    style={{ animation: 'notifIn 0.18s ease' }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                        <div className="flex items-center gap-2">
                            <Bell size={15} className="text-slate-500" />
                            <span className="text-sm font-semibold text-slate-800">Notifications</span>
                            {unread > 0 && (
                                <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full">
                                    {unread} new
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {unread > 0 && (
                                <button
                                    onClick={markAllRead}
                                    disabled={marking}
                                    className="flex items-center gap-1 text-[11px] text-emerald-600 hover:text-emerald-800 font-medium disabled:opacity-50"
                                >
                                    {marking ? <Loader2 size={11} className="animate-spin" /> : <CheckCheck size={11} />}
                                    Mark all read
                                </button>
                            )}
                            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={14} />
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100">
                        {notifications.length === 0 ? (
                            <div className="py-12 text-center">
                                <Bell size={28} className="mx-auto text-slate-300 mb-2" />
                                <p className="text-sm text-slate-400">No notifications yet</p>
                            </div>
                        ) : (
                            notifications.map(n => {
                                const meta = TYPE_META[n.type] || TYPE_META.INFO;
                                const Icon = meta.Icon;
                                return (
                                    <div
                                        key={n.notif_id}
                                        className={cn(
                                            'flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors',
                                            !n.is_read && 'bg-blue-50/40'
                                        )}
                                        onClick={() => !n.is_read && markRead(n.notif_id)}
                                    >
                                        {/* Icon */}
                                        <div className={cn('mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0', meta.bg)}>
                                            <Icon size={15} className={meta.color} />
                                        </div>
                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className={cn('text-sm font-medium text-slate-800 leading-snug', !n.is_read && 'font-semibold')}>
                                                    {n.title}
                                                </p>
                                                <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">{timeAgo(n.created_at)}</span>
                                            </div>
                                            {n.body && (
                                                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.body}</p>
                                            )}
                                            {n.deal_name && (
                                                <span className="inline-block mt-1 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">
                                                    {n.deal_name}
                                                </span>
                                            )}
                                        </div>
                                        {/* Unread dot */}
                                        {!n.is_read && (
                                            <div className="mt-2 w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <style>{`
                        @keyframes notifIn {
                            from { opacity: 0; transform: translateY(-6px) scale(0.98); }
                            to   { opacity: 1; transform: translateY(0)     scale(1); }
                        }
                    `}</style>
                </div>
            )}
        </div>
    );
}
