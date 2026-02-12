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
    const [stage, setStage] = useState('1- New Lead');
    const [probability, setProbability] = useState('20');
    const [closingDate, setClosingDate] = useState('');
    const [compId, setCompId] = useState('');
    const [level, setLevel] = useState('Standard');
    const [offering, setOffering] = useState('Web App/ Tools');
    const [priority, setPriority] = useState('');
    const [frequency, setFrequency] = useState('OneTime');
    const [remark, setRemark] = useState('');
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchCompanies();
        }
    }, [isOpen]);

    const fetchCompanies = async () => {
        try {
            const { data, error } = await supabase
                .from('companies')
                .select('comp_id, name')
                .order('name');

            if (error) throw error;

            if (data) {
                setCompanies(data);
                if (data.length > 0) setCompId(data[0].comp_id);
            }
        } catch (err) {
            console.error("Failed to fetch companies", err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!compId) {
            alert("Please select a company. If none exist, add one in Contacts first.");
            return;
        }

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
                    closing_date: closingDate || null,
                    level,
                    offering,
                    priority: priority ? parseFloat(priority) : null,
                    frequency,
                    remark
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
                const errData = await res.json();
                alert(`Failed to create deal: ${errData.error || 'Unknown error'}`);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl relative max-h-[90vh] overflow-y-auto">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 z-10">
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

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Offering</label>
                            <select
                                value={offering}
                                onChange={e => setOffering(e.target.value)}
                                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            >
                                <option>AI Agent</option>
                                <option>AI Images</option>
                                <option>AI Video Ads</option>
                                <option>B-School Consultation</option>
                                <option>Book Writing</option>
                                <option>Booking Page</option>
                                <option>Business Consulting</option>
                                <option>Courses</option>
                                <option>Dashboard</option>
                                <option>Doc- Booking</option>
                                <option>Doc- HMS</option>
                                <option>Doc- Website</option>
                                <option>Fund Raising</option>
                                <option>Insta Marketing</option>
                                <option>Market Research</option>
                                <option>Membership Platform</option>
                                <option>Mobile App</option>
                                <option>Presentations</option>
                                <option>ROI Calc</option>
                                <option>SEO- Blogs</option>
                                <option>Staff</option>
                                <option>Web App/ Tools</option>
                                <option>Website New</option>
                                <option>Website- Redesign</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Level</label>
                            <select
                                value={level}
                                onChange={e => setLevel(e.target.value)}
                                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            >
                                <option>Standard</option>
                                <option>Premium</option>
                                <option>Enterprise</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">LH Priority</label>
                            <input
                                type="number"
                                step="0.01"
                                value={priority}
                                onChange={e => setPriority(e.target.value)}
                                placeholder="e.g. 0.1"
                                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Frequency</label>
                            <select
                                value={frequency}
                                onChange={e => setFrequency(e.target.value)}
                                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            >
                                <option>OneTime</option>
                                <option>Royalty</option>
                                <option>Monthly</option>
                                <option>Annual</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700">Remark</label>
                        <textarea
                            value={remark}
                            onChange={e => setRemark(e.target.value)}
                            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            rows={2}
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
                                <option>1- New Lead</option>
                                <option>2- Discussing, RFQing</option>
                                <option>3- Presenting, Quoting</option>
                                <option>4- Negotiating, Closing</option>
                                <option>5- WIP</option>
                                <option>6- Invoice, Payment pending</option>
                                <option>7- Hold</option>
                                <option>8- Paid</option>
                                <option>9- Lost</option>
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
