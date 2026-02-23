'use client';
/**
 * FR-D.1 + FR-D.3: Email Composer with Pixel Tracking & Liquid Templates
 *
 * Features:
 *   • Liquid variable insertion ({{ lead.first_name }}, {{ deal.closing_date }}, …)
 *   • Live preview pane that renders the template against actual deal/contact data
 *   • On send: records the email_send (gets UUID), injects pixel into body
 *   • After sending: shows open/click tracking stats for prior sends
 *
 * Props:
 *   dealId   – the deal this email is associated with
 *   contId   – optional: contact the email will go to
 *   toEmail  – pre-filled recipient (editable)
 *   onClose  – called when the composer is dismissed
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
    Mail, X, Eye, EyeOff, ChevronDown, Send, Loader2,
    CheckCircle2, MousePointerClick, TrendingUp, Clock, Copy
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ───────────────────────────────────────────────────────────────────
interface Variable { key: string; label: string; }
interface EmailSend {
    send_id: string;
    subject: string;
    to_email: string;
    open_count: number;
    click_count: number;
    first_opened_at: string | null;
    sent_at: string;
}

interface Props {
    dealId: string;
    contId?: string | null;
    toEmail?: string;
    onClose?: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
    if (d < 1) return 'just now';
    if (d < 60) return `${d}m ago`;
    if (d < 1440) return `${Math.floor(d / 60)}h ago`;
    return `${Math.floor(d / 1440)}d ago`;
}

// ── Component ────────────────────────────────────────────────────────────────
export function EmailComposer({ dealId, contId, toEmail = '', onClose }: Props) {
    const API = process.env.NEXT_PUBLIC_API_URL ?? '';

    const [to, setTo] = useState(toEmail);
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('Hello {{ lead.first_name }},\n\n');
    const [preview, setPreview] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const [variables, setVariables] = useState<Variable[]>([]);
    const [showVars, setShowVars] = useState(false);
    const [history, setHistory] = useState<EmailSend[]>([]);
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const getToken = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token ?? null;
    };

    // Load available template variables from API
    useEffect(() => {
        (async () => {
            const token = await getToken();
            if (!token) return;
            const res = await fetch(`${API}/api/templates/variables`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) setVariables(await res.json());
        })();
    }, [API]);

    // Load send history for this deal
    const loadHistory = useCallback(async () => {
        const token = await getToken();
        if (!token) return;
        const res = await fetch(`${API}/api/track/sends/${dealId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) setHistory(await res.json());
    }, [API, dealId]);

    useEffect(() => { loadHistory(); }, [loadHistory]);

    // Debounced live preview
    useEffect(() => {
        if (!showPreview) return;
        if (previewTimer.current) clearTimeout(previewTimer.current);
        previewTimer.current = setTimeout(async () => {
            const token = await getToken();
            if (!token) return;
            const res = await fetch(`${API}/api/templates/preview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ template: body, deal_id: dealId, cont_id: contId })
            });
            if (res.ok) {
                const d = await res.json();
                setPreview(d.rendered);
            } else {
                const d = await res.json();
                setPreview(`⚠ ${d.error}`);
            }
        }, 600);
        return () => { if (previewTimer.current) clearTimeout(previewTimer.current); };
    }, [body, showPreview, API, dealId, contId]);

    // Insert variable at cursor
    const insertVar = (varKey: string) => {
        const ta = textareaRef.current;
        if (!ta) { setBody(b => b + varKey); setShowVars(false); return; }
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const newVal = body.slice(0, start) + varKey + body.slice(end);
        setBody(newVal);
        setShowVars(false);
        setTimeout(() => {
            ta.focus();
            ta.setSelectionRange(start + varKey.length, start + varKey.length);
        }, 0);
    };

    // Send email
    const handleSend = async () => {
        if (!to.trim() || !subject.trim() || !body.trim()) {
            setError('Please fill in To, Subject, and Body.'); return;
        }
        setSending(true);
        setError(null);
        try {
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');

            // 1. Record the send → get UUID
            const sendRes = await fetch(`${API}/api/track/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    deal_id: dealId,
                    cont_id: contId,
                    to_email: to,
                    subject,
                    body_raw: body,
                    body_html: preview || body,
                })
            });
            if (!sendRes.ok) { const d = await sendRes.json(); throw new Error(d.error); }
            const { send_id } = await sendRes.json();

            // 2. Build the final email HTML (with pixel injected server-side)
            // In a real deployment you'd pass this to a transactional mail provider (SendGrid, etc.)
            // Here we simulate: copy the final HTML + pixel to clipboard so the user can paste into their mail client
            const finalHtml = (preview || body) +
                `<img src="${API}/api/track/pixel/${send_id}" width="1" height="1" alt="" style="display:none;border:0;" />`;

            try {
                await navigator.clipboard.writeText(finalHtml);
                setCopied(true);
                setTimeout(() => setCopied(false), 3000);
            } catch { /* clipboard not available */ }

            setSent(true);
            await loadHistory();
            setTimeout(() => setSent(false), 4000);
            setSubject('');
            setBody('Hello {{ lead.first_name }},\n\n');
        } catch (e: any) {
            setError(e.message || 'Failed to send');
        } finally {
            setSending(false);
        }
    };

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden" style={{ minHeight: 480 }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-800 to-slate-700 text-white">
                <div className="flex items-center gap-2">
                    <Mail size={16} />
                    <span className="text-sm font-semibold">Email Composer</span>
                    <span className="text-[10px] text-slate-400 ml-1">— tracked + templated</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowPreview(p => !p)}
                        className={cn(
                            'flex items-center gap-1 text-[11px] px-2 py-1 rounded transition-colors',
                            showPreview ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-600'
                        )}
                    >
                        {showPreview ? <EyeOff size={11} /> : <Eye size={11} />}
                        {showPreview ? 'Hide Preview' : 'Preview'}
                    </button>
                    {onClose && (
                        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                            <X size={15} />
                        </button>
                    )}
                </div>
            </div>

            <div className={cn('flex flex-1', showPreview ? 'divide-x divide-slate-200' : '')}>
                {/* ── Left: Compose ── */}
                <div className="flex flex-col flex-1 min-w-0">
                    {/* To */}
                    <div className="flex items-center border-b border-slate-100 px-4 py-2 gap-2">
                        <span className="text-xs text-slate-400 w-12 shrink-0">To</span>
                        <input
                            id="email-to"
                            type="email"
                            value={to}
                            onChange={e => setTo(e.target.value)}
                            placeholder="recipient@example.com"
                            className="flex-1 text-sm outline-none text-slate-800 placeholder:text-slate-300"
                        />
                    </div>

                    {/* Subject */}
                    <div className="flex items-center border-b border-slate-100 px-4 py-2 gap-2">
                        <span className="text-xs text-slate-400 w-12 shrink-0">Subject</span>
                        <input
                            id="email-subject"
                            value={subject}
                            onChange={e => setSubject(e.target.value)}
                            placeholder="Email subject…"
                            className="flex-1 text-sm outline-none text-slate-800 placeholder:text-slate-300"
                        />
                    </div>

                    {/* Toolbar */}
                    <div className="flex items-center gap-2 px-4 py-1.5 border-b border-slate-100 bg-slate-50">
                        {/* Insert Variable */}
                        <div className="relative">
                            <button
                                id="insert-variable-btn"
                                onClick={() => setShowVars(v => !v)}
                                className="flex items-center gap-1 text-[11px] px-2 py-1 bg-violet-100 hover:bg-violet-200 text-violet-700 rounded font-medium transition-colors"
                            >
                                {'{ }'} Insert Variable
                                <ChevronDown size={10} />
                            </button>
                            {showVars && (
                                <div className="absolute top-full left-0 mt-1 z-20 bg-white rounded-xl border border-slate-200 shadow-xl w-64 max-h-64 overflow-y-auto py-1">
                                    {variables.map(v => (
                                        <button
                                            key={v.key}
                                            onClick={() => insertVar(v.key)}
                                            className="w-full text-left px-3 py-2 hover:bg-violet-50 transition-colors"
                                        >
                                            <p className="text-xs font-mono text-violet-700">{v.key}</p>
                                            <p className="text-[10px] text-slate-400">{v.label}</p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="ml-auto flex items-center gap-1 text-[10px] text-slate-400">
                            <TrendingUp size={10} />
                            Pixel tracking enabled
                        </div>
                    </div>

                    {/* Body */}
                    <textarea
                        id="email-body"
                        ref={textareaRef}
                        value={body}
                        onChange={e => setBody(e.target.value)}
                        placeholder="Write your email here… Use {{ lead.first_name }} for dynamic fields."
                        className="flex-1 px-4 py-3 text-sm text-slate-800 outline-none resize-none placeholder:text-slate-300 font-mono leading-relaxed"
                    />

                    {/* Footer */}
                    <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
                        {error && <p className="text-xs text-red-500 flex-1">{error}</p>}
                        {sent && (
                            <div className="flex items-center gap-1 text-emerald-600 text-xs flex-1">
                                <CheckCircle2 size={13} />
                                Recorded! {copied && <span className="text-slate-500">(HTML + pixel copied to clipboard)</span>}
                            </div>
                        )}
                        <button
                            id="send-email-btn"
                            onClick={handleSend}
                            disabled={sending}
                            className="ml-auto flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                        >
                            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                            Send & Track
                        </button>
                    </div>
                </div>

                {/* ── Right: Live Preview ── */}
                {showPreview && (
                    <div className="flex flex-col w-80 shrink-0">
                        <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Rendered Preview</p>
                        </div>
                        <div
                            className="flex-1 px-4 py-3 text-sm text-slate-700 leading-relaxed overflow-y-auto whitespace-pre-wrap font-sans"
                            dangerouslySetInnerHTML={{ __html: preview || '<span style="color:#94a3b8">Start typing to see preview…</span>' }}
                        />
                    </div>
                )}
            </div>

            {/* ── Send History ─────────────────────────────────────────────────── */}
            {history.length > 0 && (
                <div className="border-t border-slate-100">
                    <div className="px-4 py-2 bg-slate-50 flex items-center gap-2">
                        <Clock size={12} className="text-slate-400" />
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Send History</span>
                    </div>
                    <div className="divide-y divide-slate-50 max-h-44 overflow-y-auto">
                        {history.map(s => (
                            <div key={s.send_id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                                {/* Subject */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-slate-800 truncate">{s.subject}</p>
                                    <p className="text-[10px] text-slate-400">{s.to_email} · {timeAgo(s.sent_at)}</p>
                                </div>
                                {/* Stats */}
                                <div className="flex items-center gap-3 shrink-0">
                                    <div className="flex items-center gap-1" title="Opens">
                                        <Eye size={11} className={s.open_count > 0 ? 'text-emerald-500' : 'text-slate-300'} />
                                        <span className={cn('text-[11px] font-bold', s.open_count > 0 ? 'text-emerald-600' : 'text-slate-300')}>
                                            {s.open_count}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1" title="Link Clicks">
                                        <MousePointerClick size={11} className={s.click_count > 0 ? 'text-violet-500' : 'text-slate-300'} />
                                        <span className={cn('text-[11px] font-bold', s.click_count > 0 ? 'text-violet-600' : 'text-slate-300')}>
                                            {s.click_count}
                                        </span>
                                    </div>
                                    {s.first_opened_at && (
                                        <span className="text-[10px] text-slate-400">First opened {timeAgo(s.first_opened_at)}</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
