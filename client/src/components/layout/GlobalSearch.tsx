'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Search, X, User, Building, Briefcase, Users, Loader2 } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SearchResult {
    id: string;
    type: 'contact' | 'company' | 'deal' | 'user';
    title: string;
    subtitle?: string;
    meta?: string;
    url_id?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<
    SearchResult['type'],
    { label: string; icon: React.FC<{ className?: string }>; color: string; bg: string; href: (r: SearchResult) => string }
> = {
    contact: { label: 'Contact', icon: User, color: 'text-sky-600', bg: 'bg-sky-50', href: () => '/contacts' },
    company: { label: 'Company', icon: Building, color: 'text-violet-600', bg: 'bg-violet-50', href: () => '/contacts' },
    deal: { label: 'Deal', icon: Briefcase, color: 'text-emerald-600', bg: 'bg-emerald-50', href: (r) => `/deals` },
    user: { label: 'Team', icon: Users, color: 'text-amber-600', bg: 'bg-amber-50', href: () => '/settings' },
};

// Simple debounce helper
function useDebounce<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function GlobalSearch() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [focused, setFocused] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const debouncedQuery = useDebounce(query, 280); // 280 ms debounce

    // ── Fetch results ────────────────────────────────────────────────────────
    useEffect(() => {
        if (debouncedQuery.length < 2) {
            setResults([]);
            setOpen(false);
            return;
        }

        let cancelled = false;
        const fetchResults = async () => {
            setLoading(true);
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;

                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL}/api/search?q=${encodeURIComponent(debouncedQuery)}&limit=12`,
                    { headers: { Authorization: `Bearer ${session.access_token}` } }
                );
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                if (!cancelled) {
                    setResults(data.results || []);
                    setOpen(true);
                    setFocused(0);
                }
            } catch (err) {
                console.error('[GlobalSearch] fetch error:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchResults();
        return () => { cancelled = true; };
    }, [debouncedQuery]);

    // ── Keyboard navigation ──────────────────────────────────────────────────
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!open) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setFocused(f => Math.min(f + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setFocused(f => Math.max(f - 1, 0));
        } else if (e.key === 'Enter' && results[focused]) {
            e.preventDefault();
            navigate(results[focused]);
        } else if (e.key === 'Escape') {
            setOpen(false);
            inputRef.current?.blur();
        }
    };

    // ── Navigate to result ───────────────────────────────────────────────────
    const navigate = useCallback((result: SearchResult) => {
        const cfg = TYPE_CONFIG[result.type];
        router.push(cfg.href(result));
        setQuery('');
        setOpen(false);
    }, [router]);

    // ── Close on outside click ───────────────────────────────────────────────
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (
                panelRef.current && !panelRef.current.contains(e.target as Node) &&
                inputRef.current && !inputRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ── Group results by type for rendering ──────────────────────────────────
    const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
        acc[r.type] = acc[r.type] ? [...acc[r.type], r] : [r];
        return acc;
    }, {});

    const typeOrder: SearchResult['type'][] = ['deal', 'contact', 'company', 'user'];
    // Flat ordered list (for keyboard nav index tracking)
    const ordered = typeOrder.flatMap(t => grouped[t] || []);

    return (
        <div className="relative w-full">
            {/* ── Input ─────────────────────────────────────────────────── */}
            <div className="relative flex items-center">
                <Search className="absolute left-3 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                    ref={inputRef}
                    id="global-search-input"
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Search deals, contacts, companies…"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => { if (results.length > 0) setOpen(true); }}
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 py-2 pl-9 pr-9 text-sm text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
                {loading && (
                    <Loader2 className="absolute right-3 h-4 w-4 animate-spin text-slate-400" />
                )}
                {!loading && query && (
                    <button
                        onClick={() => { setQuery(''); setResults([]); setOpen(false); inputRef.current?.focus(); }}
                        className="absolute right-3 text-slate-400 hover:text-slate-200"
                        aria-label="Clear search"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* ── Results Panel ─────────────────────────────────────────── */}
            {open && ordered.length > 0 && (
                <div
                    ref={panelRef}
                    className="absolute left-0 top-full z-[9999] mt-2 w-[380px] max-h-[480px] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-2xl ring-1 ring-black/20"
                >
                    {typeOrder.map(type => {
                        const group = grouped[type];
                        if (!group || group.length === 0) return null;
                        const cfg = TYPE_CONFIG[type];
                        const Icon = cfg.icon;
                        return (
                            <div key={type}>
                                {/* Group header */}
                                <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-800">
                                    <span className={`text-xs font-semibold uppercase tracking-wider ${cfg.color}`}>
                                        {cfg.label}s
                                    </span>
                                </div>
                                {group.map(result => {
                                    const globalIdx = ordered.indexOf(result);
                                    const isFocused = globalIdx === focused;
                                    return (
                                        <button
                                            key={result.id}
                                            onMouseEnter={() => setFocused(globalIdx)}
                                            onClick={() => navigate(result)}
                                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isFocused ? 'bg-slate-800' : 'hover:bg-slate-800/60'
                                                }`}
                                        >
                                            {/* Icon badge */}
                                            <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${cfg.bg}`}>
                                                <Icon className={`h-4 w-4 ${cfg.color}`} />
                                            </div>
                                            {/* Text */}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-slate-100 truncate">
                                                    <Highlight text={result.title} query={debouncedQuery} />
                                                </div>
                                                {result.subtitle && (
                                                    <div className="text-xs text-slate-400 truncate">
                                                        <Highlight text={result.subtitle} query={debouncedQuery} />
                                                        {result.meta && (
                                                            <span className="ml-2 text-slate-600">· {result.meta}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            {/* Type badge */}
                                            <span className={`flex-shrink-0 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>
                                                {cfg.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })}

                    {/* Footer */}
                    <div className="border-t border-slate-800 px-4 py-2 text-[10px] text-slate-600">
                        {ordered.length} result{ordered.length !== 1 ? 's' : ''} · ↑↓ to navigate · Enter to open · Esc to close
                    </div>
                </div>
            )}

            {/* Empty state */}
            {open && debouncedQuery.length >= 2 && !loading && ordered.length === 0 && (
                <div
                    ref={panelRef}
                    className="absolute left-0 top-full z-[9999] mt-2 w-[380px] rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
                >
                    <div className="px-4 py-8 text-center text-sm text-slate-500">
                        No results for &ldquo;<span className="text-slate-300">{debouncedQuery}</span>&rdquo;
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Highlight matching substring ─────────────────────────────────────────────
function Highlight({ text, query }: { text: string; query: string }) {
    if (!query || !text) return <>{text}</>;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
        <>
            {parts.map((part, i) =>
                regex.test(part) ? (
                    <mark key={i} className="bg-emerald-500/30 text-emerald-300 rounded px-0.5 not-italic">
                        {part}
                    </mark>
                ) : (
                    <span key={i}>{part}</span>
                )
            )}
        </>
    );
}
