'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X } from 'lucide-react';
import { CURRENCY_CONFIG } from '@/lib/currency';

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
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Check if company with same name already exists
            const { count, error: countError } = await supabase
                .from("companies")
                .select("comp_id", { count: 'exact', head: true })
                .ilike("name", name);

            if (countError) throw countError;

            if (count && count > 0) {
                setError(`Company with name "${name}" already exists.`);
                setLoading(false);
                return;
            }

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
            setError(`Failed to create company: ${err instanceof Error ? err.message : 'Unknown error'}`);
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

                {error && (
                    <div className="mb-4 p-3 rounded bg-red-50 text-red-600 text-sm border border-red-200">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">
                            Company Name <span className="text-red-500">*</span>
                        </label>
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
                        <label className="block text-sm font-medium text-slate-700">
                            Domain <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            value={domain}
                            onChange={e => setDomain(e.target.value)}
                            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            placeholder="acme.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">
                            Industry <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            value={industry}
                            onChange={e => setIndustry(e.target.value)}
                            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            placeholder="Technology"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">
                            Annual Revenue ({CURRENCY_CONFIG.symbol}) <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            required
                            value={revenue}
                            onChange={e => setRevenue(e.target.value)}
                            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            placeholder="1000000"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !name || !domain || !industry || !revenue}
                        className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Adding...' : 'Add Company'}
                    </button>
                </form>
            </div>
        </div>
    );
}
