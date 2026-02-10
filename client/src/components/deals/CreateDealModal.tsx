'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { X } from 'lucide-react';

interface Company {
    comp_id: string;
    name: string;
}

interface CreateDealModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newDeal: any) => void;
}

export function CreateDealModal({ isOpen, onClose, onSuccess }: CreateDealModalProps) {
    const [name, setName] = useState('');
    const [value, setValue] = useState('');
    const [stage, setStage] = useState('Lead');
    const [probability, setProbability] = useState('20');
    const [closingDate, setClosingDate] = useState('');
    const [compId, setCompId] = useState('');
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchCompanies();
        }
    }, [isOpen]);

    const fetchCompanies = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/companies`, {
                    headers: { 'Authorization': `Bearer ${session.access_token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setCompanies(data);
                    if (data.length > 0) setCompId(data[0].comp_id);
                }
            } catch (err) {
                console.error("Failed to fetch companies", err);
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/deals`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    name,
                    comp_id: compId,
                    value: parseFloat(value),
                    stage,
                    probability: parseInt(probability),
                    closing_date: closingDate || null
                })
            });

            if (res.ok) {
                const newDeal = await res.json();
                onSuccess(newDeal);
                onClose();
                // Reset form
                setName('');
                setValue('');
            } else {
                alert('Failed to create deal');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                    <X size={20} />
                </button>
                <h2 className="mb-4 text-xl font-bold text-slate-900">Create New Deal</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Deal Name</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            placeholder="e.g. Q4 Software License"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700">Company</label>
                        <select
                            value={compId}
                            onChange={e => setCompId(e.target.value)}
                            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                            <option value="" disabled>Select a company</option>
                            {companies.map(c => (
                                <option key={c.comp_id} value={c.comp_id}>{c.name}</option>
                            ))}
                        </select>
                        <p className="text-xs text-slate-500 mt-1">If company is missing, add it in Contacts.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Value ($)</label>
                            <input
                                type="number"
                                required
                                value={value}
                                onChange={e => setValue(e.target.value)}
                                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                placeholder="10000"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Probability (%)</label>
                            <input
                                type="number"
                                required
                                min="0" max="100"
                                value={probability}
                                onChange={e => setProbability(e.target.value)}
                                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Stage</label>
                            <select
                                value={stage}
                                onChange={e => setStage(e.target.value)}
                                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            >
                                <option>Lead</option>
                                <option>Meeting</option>
                                <option>Proposal</option>
                                <option>Closed</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Closing Date</label>
                            <input
                                type="date"
                                value={closingDate}
                                onChange={e => setClosingDate(e.target.value)}
                                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                        {loading ? 'Creating...' : 'Create Deal'}
                    </button>
                </form>
            </div>
        </div>
    );
}
