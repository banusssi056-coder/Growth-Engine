'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
    GripVertical, Plus, Pencil, Trash2, Check, X,
    Loader2, AlertTriangle, ChevronUp, ChevronDown
} from 'lucide-react';

interface Stage {
    stage_id: string;
    name: string;
    color: string;
    position: number;
    probability: number;
    is_active: boolean;
}

const COLOR_OPTIONS = [
    { hex: '#3b82f6', label: 'Blue' },
    { hex: '#f59e0b', label: 'Amber' },
    { hex: '#10b981', label: 'Emerald' },
    { hex: '#ef4444', label: 'Red' },
    { hex: '#8b5cf6', label: 'Violet' },
    { hex: '#94a3b8', label: 'Slate' },
    { hex: '#f97316', label: 'Orange' },
    { hex: '#06b6d4', label: 'Cyan' },
];

export function StageManager() {
    const [stages, setStages] = useState<Stage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editId, setEditId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState('#94a3b8');
    const [editProb, setEditProb] = useState(10);
    const [savingId, setSavingId] = useState<string | null>(null);

    // New stage form
    const [showAdd, setShowAdd] = useState(false);
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState('#94a3b8');
    const [newProb, setNewProb] = useState(10);
    const [adding, setAdding] = useState(false);

    const getToken = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token ?? null;
    };

    const fetchStages = useCallback(async () => {
        setLoading(true);
        try {
            const token = await getToken();
            if (!token) return;
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stages`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) setStages(await res.json());
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchStages(); }, [fetchStages]);

    const startEdit = (s: Stage) => {
        setEditId(s.stage_id);
        setEditName(s.name);
        setEditColor(s.color);
        setEditProb(s.probability);
        setError(null);
    };
    const cancelEdit = () => { setEditId(null); setError(null); };

    const saveEdit = async (id: string) => {
        setSavingId(id);
        setError(null);
        try {
            const token = await getToken();
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stages/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ name: editName, color: editColor, probability: editProb })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setStages(prev => prev.map(s => s.stage_id === id ? data : s));
            setEditId(null);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSavingId(null);
        }
    };

    const deleteStage = async (id: string) => {
        if (!confirm('Remove this stage? Deals in it must be moved first.')) return;
        setSavingId(id);
        setError(null);
        try {
            const token = await getToken();
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stages/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setStages(prev => prev.filter(s => s.stage_id !== id));
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSavingId(null);
        }
    };

    const moveStage = async (id: string, dir: 'up' | 'down') => {
        const idx = stages.findIndex(s => s.stage_id === id);
        if ((dir === 'up' && idx === 0) || (dir === 'down' && idx === stages.length - 1)) return;
        const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
        const newOrder = [...stages];
        [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
        setStages(newOrder);
        // Persist new positions
        const token = await getToken();
        await Promise.all([
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stages/${newOrder[idx].stage_id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ position: idx + 1 })
            }),
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stages/${newOrder[swapIdx].stage_id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ position: swapIdx + 1 })
            }),
        ]);
    };

    const addStage = async () => {
        if (!newName.trim()) return;
        setAdding(true);
        setError(null);
        try {
            const token = await getToken();
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ name: newName.trim(), color: newColor, probability: newProb })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setStages(prev => [...prev, data]);
            setShowAdd(false);
            setNewName(''); setNewColor('#94a3b8'); setNewProb(10);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setAdding(false);
        }
    };

    if (loading) return (
        <div className="flex items-center gap-2 text-slate-400 py-8 justify-center">
            <Loader2 size={16} className="animate-spin" /> Loading stages…
        </div>
    );

    return (
        <div className="space-y-4">
            {/* Error banner */}
            {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-2 rounded-lg">
                    <AlertTriangle size={14} />
                    <span>{error}</span>
                    <button className="ml-auto" onClick={() => setError(null)}><X size={12} /></button>
                </div>
            )}

            {/* Stage list */}
            <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                {stages.map((s, i) => (
                    <div
                        key={s.stage_id}
                        className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50/60 transition-colors group"
                    >
                        {/* Reorder */}
                        <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => moveStage(s.stage_id, 'up')}
                                disabled={i === 0}
                                className="p-0.5 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20"
                            ><ChevronUp size={12} /></button>
                            <button
                                onClick={() => moveStage(s.stage_id, 'down')}
                                disabled={i === stages.length - 1}
                                className="p-0.5 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20"
                            ><ChevronDown size={12} /></button>
                        </div>
                        <GripVertical size={14} className="text-slate-300 shrink-0" />

                        {/* Color dot */}
                        <div
                            className="w-3 h-3 rounded-full shrink-0 ring-2 ring-offset-1"
                            style={{ backgroundColor: s.color }}
                        />

                        {editId === s.stage_id ? (
                            /* Edit mode */
                            <div className="flex-1 flex items-center gap-2 flex-wrap">
                                <input
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="flex-1 min-w-0 border border-slate-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                                    placeholder="Stage name"
                                    autoFocus
                                />
                                <div className="flex gap-1">
                                    {COLOR_OPTIONS.map(c => (
                                        <button
                                            key={c.hex}
                                            onClick={() => setEditColor(c.hex)}
                                            title={c.label}
                                            className={`w-5 h-5 rounded-full ring-offset-1 transition-transform hover:scale-110 ${editColor === c.hex ? 'ring-2 ring-slate-700 scale-110' : ''}`}
                                            style={{ backgroundColor: c.hex }}
                                        />
                                    ))}
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                    <span>Prob</span>
                                    <input
                                        type="number" min={0} max={100}
                                        value={editProb}
                                        onChange={(e) => setEditProb(Number(e.target.value))}
                                        className="w-14 border border-slate-300 rounded px-1.5 py-0.5 text-xs focus:ring-1 focus:ring-emerald-400 focus:outline-none"
                                    />
                                    <span>%</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => saveEdit(s.stage_id)}
                                        disabled={savingId === s.stage_id}
                                        className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                                    >
                                        {savingId === s.stage_id
                                            ? <Loader2 size={12} className="animate-spin" />
                                            : <Check size={12} />
                                        }
                                    </button>
                                    <button
                                        onClick={cancelEdit}
                                        className="p-1.5 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* View mode */
                            <>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-800 truncate">{s.name}</p>
                                    <p className="text-xs text-slate-400">Probability: {s.probability}%</p>
                                </div>
                                <span className="text-xs text-slate-400 font-mono">#{i + 1}</span>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => startEdit(s)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                        title="Rename stage"
                                    ><Pencil size={13} /></button>
                                    <button
                                        onClick={() => deleteStage(s.stage_id)}
                                        disabled={savingId === s.stage_id}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                                        title="Remove stage"
                                    >
                                        {savingId === s.stage_id
                                            ? <Loader2 size={13} className="animate-spin" />
                                            : <Trash2 size={13} />
                                        }
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>

            {/* Add new stage */}
            {showAdd ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-widest">New Stage</p>
                    <div className="flex gap-2 items-center flex-wrap">
                        <input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addStage()}
                            className="flex-1 min-w-[160px] border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                            placeholder="Stage name (e.g. 10- Follow-up)"
                            autoFocus
                        />
                        <div className="flex gap-1">
                            {COLOR_OPTIONS.map(c => (
                                <button
                                    key={c.hex}
                                    onClick={() => setNewColor(c.hex)}
                                    title={c.label}
                                    className={`w-5 h-5 rounded-full ring-offset-1 transition-transform hover:scale-110 ${newColor === c.hex ? 'ring-2 ring-slate-700 scale-110' : ''}`}
                                    style={{ backgroundColor: c.hex }}
                                />
                            ))}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <span>Prob</span>
                            <input
                                type="number" min={0} max={100}
                                value={newProb}
                                onChange={(e) => setNewProb(Number(e.target.value))}
                                className="w-14 border border-slate-300 rounded px-1.5 py-0.5 text-xs focus:ring-1 focus:ring-emerald-400 focus:outline-none"
                            />
                            <span>%</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={addStage}
                            disabled={adding || !newName.trim()}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                        >
                            {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                            Add Stage
                        </button>
                        <button
                            onClick={() => { setShowAdd(false); setNewName(''); setError(null); }}
                            className="px-4 py-1.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    onClick={() => setShowAdd(true)}
                    className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-emerald-400 hover:text-emerald-600 text-sm font-medium transition-colors"
                >
                    <Plus size={15} />
                    Add a new pipeline stage
                </button>
            )}
        </div>
    );
}
