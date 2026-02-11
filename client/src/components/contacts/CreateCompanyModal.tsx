'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X } from 'lucide-react';

interface CreateCompanyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newCompany: any) => void;
}

export function CreateCompanyModal({ isOpen, onClose, onSuccess }: CreateCompanyModalProps) {
    const [name, setName] = useState('');
    const [domain, setDomain] = useState('');
    const [industry, setIndustry] = useState('');
    const [revenue, setRevenue] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { error } = await supabase.from("companies").insert([
                {
                    name: name,
                    domain,
                    industry,
                    revenue: revenue ? parseFloat(revenue) : null
                }
            ]);

            if (error) throw error;

            onSuccess({ name, domain, industry, revenue });
            onClose();
            setName('');
            setDomain('');
            setIndustry('');
            setRevenue('');
        } catch (err) {
            console.error(err);
            alert(`Failed to create company: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
                <h2 className="mb-4 text-xl font-bold text-slate-900">Add New Company</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Company Name</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            placeholder="Acme Corp"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Domain</label>
                        <input
                            type="text"
                            value={domain}
                            onChange={e => setDomain(e.target.value)}
                            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            placeholder="acme.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Industry</label>
                        <input
                            type="text"
                            value={industry}
                            onChange={e => setIndustry(e.target.value)}
                            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            placeholder="Technology"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Annual Revenue ($)</label>
                        <input
                            type="number"
                            value={revenue}
                            onChange={e => setRevenue(e.target.value)}
                            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            placeholder="1000000"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                        {loading ? 'Adding...' : 'Add Company'}
                    </button>
                </form>
            </div>
        </div>
    );
}
