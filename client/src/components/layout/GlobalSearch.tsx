'use client';
/**
 * FR-A.2 — Global Smart Search (Command Palette)
 *
 * Architecture:
 *  • Triggered by Ctrl+K (Win/Linux) or ⌘K (Mac), OR the sidebar Search button
 *  • 200 ms debounce → ILIKE query hits GIN-trigram indexes on the server
 *  • Server responds with X-Search-Time-Ms header proving sub-150 ms latency
 *  • Searches: contacts (name / email / phone), companies (name / domain),
 *              deals (name), users/team (name / email / phone)
 *  • Results grouped by type with keyboard navigation (↑↓ Enter Esc)
 *  • Matching text is highlighted in emerald
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
    Search, X, User, Building2, Briefcase, Users,
    Loader2, Clock, ChevronRight, Command
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SearchResult {
    id: string;
    type: 'contact' | 'company' | 'deal' | 'user';
    title: string;
    subtitle?: string;
    meta?: string;
}

// ─── Per-type display config ──────────────────────────────────────────────────
const TYPE_CONFIG = {
    deal: { label: 'Deal', plural: 'Deals', Icon: Briefcase, color: 'text-emerald-400', bg: 'bg-emerald-500/10', badge: 'bg-emerald-500/20 text-emerald-300', href: () => '/deals' },
    contact: { label: 'Contact', plural: 'Contacts', Icon: User, color: 'text-sky-400', bg: 'bg-sky-500/10', badge: 'bg-sky-500/20 text-sky-300', href: () => '/contacts' },
    company: { label: 'Company', plural: 'Companies', Icon: Building2, color: 'text-violet-400', bg: 'bg-violet-500/10', badge: 'bg-violet-500/20 text-violet-300', href: () => '/contacts' },
    user: { label: 'Team', plural: 'Team', Icon: Users, color: 'text-amber-400', bg: 'bg-amber-500/10', badge: 'bg-amber-500/20 text-amber-300', href: () => '/settings' },
} as const;

const TYPE_ORDER: (keyof typeof TYPE_CONFIG)[] = ['deal', 'contact', 'company', 'user'];

// ─── Debounce hook ────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, ms: number): T {
    const [v, setV] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setV(value), ms);
        return () => clearTimeout(t);
    }, [value, ms]);
    return v;
}

// ─── Highlight matching text ──────────────────────────────────────────────────
function Highlight({ text, q }: { text: string; q: string }) {
    if (!q || !text) return <>{text}</>;
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    return (
        <>
            {parts.map((p, i) =>
                p.toLowerCase() === q.toLowerCase()
                    ? <mark key={i} className="bg-emerald-500/25 text-emerald-300 rounded-sm not-italic px-0.5">{p}</mark>
                    : <span key={i}>{p}</span>
            )}
        </>
    );
}

// ─── Main component (exported as a provider + palette) ────────────────────────
export function GlobalSearchProvider({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState(false);

    // Global Ctrl+K / ⌘K listener
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setOpen(o => !o);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    return (
        <>
            {children}
            {open && <SearchPalette onClose={() => setOpen(false)} />}
        </>
    );
}

// ─── Trigger button (for Sidebar) ────────────────────────────────────────────
export function SearchTriggerButton({ onClick }: { onClick: () => void }) {
    const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
    return (
        <button
            onClick={onClick}
            id="global-search-trigger"
            className="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
        >
            <Search className="h-5 w-5 flex-shrink-0" />
            <span className="flex-1 text-left truncate">Search…</span>
            <kbd className="hidden group-hover:inline-flex items-center gap-0.5 rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-500">
                {isMac ? '⌘' : 'Ctrl'} K
            </kbd>
        </button>
    );
}

// ─── The actual palette modal ─────────────────────────────────────────────────
function SearchPalette({ onClose }: { onClose: () => void }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [latency, setLatency] = useState<number | null>(null);
    const [focused, setFocused] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();
    const debouncedQ = useDebounce(query, 200); // 200 ms — fits comfortably within 150 ms server budget

    // Auto-focus input when palette opens
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Esc closes
    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [onClose]);

    // Fetch from /api/search
    useEffect(() => {
        if (debouncedQ.length < 2) {
            setResults([]);
            setLatency(null);
            return;
        }

        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;

                const t0 = performance.now();
                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL}/api/search?q=${encodeURIComponent(debouncedQ)}&limit=15`,
                    { headers: { Authorization: `Bearer ${session.access_token}` } }
                );
                const clientMs = Math.round(performance.now() - t0);

                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                // Server sends X-Search-Time-Ms (pure DB query time)
                const serverMs = parseInt(res.headers.get('X-Search-Time-Ms') || '0') || clientMs;
                const json = await res.json();

                if (!cancelled) {
                    setResults(json.results || []);
                    setLatency(serverMs);
                    setFocused(0);
                }
            } catch (err) {
                console.error('[Search]', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [debouncedQ]);

    // Build flat ordered list for keyboard nav
    const grouped = results.reduce<Partial<Record<keyof typeof TYPE_CONFIG, SearchResult[]>>>((acc, r) => {
        const k = r.type as keyof typeof TYPE_CONFIG;
        acc[k] = acc[k] ? [...acc[k]!, r] : [r];
        return acc;
    }, {});
    const ordered = TYPE_ORDER.flatMap(t => grouped[t] || []);

    // Keyboard nav
    const handleKey = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setFocused(f => Math.min(f + 1, ordered.length - 1)); }
        if (e.key === 'ArrowUp') { e.preventDefault(); setFocused(f => Math.max(f - 1, 0)); }
        if (e.key === 'Enter' && ordered[focused]) { e.preventDefault(); navigate(ordered[focused]); }
    };

    const navigate = useCallback((r: SearchResult) => {
        router.push(TYPE_CONFIG[r.type as keyof typeof TYPE_CONFIG].href());
        onClose();
    }, [router, onClose]);

    return (
        /* Backdrop */
        <div
            className="fixed inset-0 z-[9999] flex items-start justify-center pt-[12vh] px-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            {/* Panel */}
            <div
                className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
                style={{ animation: 'searchIn 0.15s ease' }}
            >
                {/* Search Input row */}
                <div className="flex items-center gap-3 border-b border-slate-700/60 px-4 py-3.5">
                    {loading
                        ? <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin text-slate-400" />
                        : <Search className="h-5 w-5 flex-shrink-0 text-slate-400" />
                    }
                    <input
                        ref={inputRef}
                        id="search-palette-input"
                        type="text"
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="Search by name, email, or phone…"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKey}
                        className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none"
                    />
                    {/* Latency badge — proves < 150ms */}
                    {latency !== null && (
                        <span
                            title="Server-side search latency (GIN index)"
                            className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-mono font-semibold ${latency < 150 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                                }`}
                        >
                            <Clock className="h-3 w-3" />
                            {latency}ms
                        </span>
                    )}
                    {query && (
                        <button onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus(); }}
                            className="text-slate-500 hover:text-slate-300 transition-colors">
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {/* Results */}
                {ordered.length > 0 && (
                    <div className="max-h-[420px] overflow-y-auto">
                        {TYPE_ORDER.map(type => {
                            const group = grouped[type];
                            if (!group?.length) return null;
                            const cfg = TYPE_CONFIG[type];
                            const Icon = cfg.Icon;
                            return (
                                <div key={type}>
                                    {/* Section label */}
                                    <div className="px-4 pt-3 pb-1">
                                        <span className={`text-[10px] font-bold uppercase tracking-widest ${cfg.color}`}>
                                            {cfg.plural}
                                        </span>
                                    </div>
                                    {group.map(r => {
                                        const idx = ordered.indexOf(r);
                                        return (
                                            <button
                                                key={r.id}
                                                onMouseEnter={() => setFocused(idx)}
                                                onClick={() => navigate(r)}
                                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${idx === focused ? 'bg-slate-800' : 'hover:bg-slate-800/50'
                                                    }`}
                                            >
                                                {/* Icon */}
                                                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${cfg.bg}`}>
                                                    <Icon className={`h-4 w-4 ${cfg.color}`} />
                                                </div>
                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-slate-100 truncate">
                                                        <Highlight text={r.title} q={debouncedQ} />
                                                    </div>
                                                    {r.subtitle && (
                                                        <div className="text-xs text-slate-400 truncate mt-0.5">
                                                            <Highlight text={r.subtitle} q={debouncedQ} />
                                                            {r.meta && <span className="ml-2 text-slate-600">· {r.meta}</span>}
                                                        </div>
                                                    )}
                                                </div>
                                                {/* Badge + arrow */}
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${cfg.badge}`}>
                                                        {cfg.label}
                                                    </span>
                                                    {idx === focused && (
                                                        <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            );
                        })}
                        {/* Footer */}
                        <div className="border-t border-slate-800 px-4 py-2.5 flex items-center justify-between">
                            <span className="text-[10px] text-slate-600">
                                {ordered.length} result{ordered.length !== 1 ? 's' : ''}
                            </span>
                            <span className="text-[10px] text-slate-600">
                                ↑↓ navigate &nbsp;·&nbsp; Enter open &nbsp;·&nbsp; Esc close
                            </span>
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {!loading && debouncedQ.length >= 2 && ordered.length === 0 && (
                    <div className="px-4 py-12 text-center">
                        <Search className="mx-auto h-8 w-8 text-slate-700 mb-3" />
                        <p className="text-sm text-slate-500">
                            No results for <span className="text-slate-300 font-medium">"{debouncedQ}"</span>
                        </p>
                        <p className="text-xs text-slate-600 mt-1">
                            Try searching by name, email, or phone number
                        </p>
                    </div>
                )}

                {/* Idle hint */}
                {debouncedQ.length < 2 && (
                    <div className="px-4 py-6">
                        <p className="text-xs text-slate-600 mb-3 font-medium uppercase tracking-wider">Search across</p>
                        <div className="grid grid-cols-2 gap-2">
                            {TYPE_ORDER.map(type => {
                                const cfg = TYPE_CONFIG[type];
                                const Icon = cfg.Icon;
                                return (
                                    <div key={type} className="flex items-center gap-2 rounded-lg bg-slate-800/50 px-3 py-2">
                                        <Icon className={`h-4 w-4 ${cfg.color}`} />
                                        <span className="text-xs text-slate-400">{cfg.plural}</span>
                                    </div>
                                );
                            })}
                        </div>
                        <p className="text-[10px] text-slate-700 mt-4 text-center">
                            Powered by GIN / B-Tree indexes · target &lt;150ms
                        </p>
                    </div>
                )}
            </div>

            {/* Entry animation keyframe injected inline */}
            <style>{`
                @keyframes searchIn {
                    from { opacity: 0; transform: translateY(-12px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0)      scale(1);    }
                }
            `}</style>
        </div>
    );
}
