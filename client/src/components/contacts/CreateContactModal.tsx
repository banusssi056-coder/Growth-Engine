'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { X, User, Mail, Phone, Building } from 'lucide-react';

interface CreateContactModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (contact: any) => void;
}

export function CreateContactModal({ isOpen, onClose, onSuccess }: CreateContactModalProps) {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [jobTitle, setJobTitle] = useState('');
    const [compId, setCompId] = useState('');
    const [companies, setCompanies] = useState<any[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchCompanies();
        }
    }, [isOpen]);

    const fetchCompanies = async () => {
        const { data } = await supabase.from('companies').select('comp_id, name').order('name');
        if (data) setCompanies(data);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const { data, error } = await supabase
                .from('contacts')
                .insert([
                    {
                        first_name: firstName,
                        last_name: lastName,
                        email,
                        phone: phone || null,
                        job_title: jobTitle || null,
                        comp_id: compId || null,
                    }
                ])
                .select()
                .single();

            if (error) throw error;

            onSuccess(data);
            handleClose();
        } catch (err: any) {
            console.error("Error creating contact:", err);
            alert(err.message || "Failed to create contact");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setFirstName('');
        setLastName('');
        setEmail('');
        setPhone('');
        setJobTitle('');
        setCompId('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
                    <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                        <User className="text-emerald-600" size={20} />
                        New Contact
                    </h3>
                    <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">First Name</label>
                            <input
                                required
                                type="text"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none transition-all"
                                placeholder="John"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Name</label>
                            <input
                                required
                                type="text"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none transition-all"
                                placeholder="Doe"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Job Title</label>
                            <input
                                type="text"
                                value={jobTitle}
                                onChange={(e) => setJobTitle(e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none transition-all"
                                placeholder="Manager"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone</label>
                            <input
                                type="text"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none transition-all"
                                placeholder="+1..."
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                required
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 py-2 text-sm focus:border-emerald-500 focus:outline-none transition-all"
                                placeholder="john.doe@example.com"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Company (Optional)</label>
                        <div className="relative">
                            <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <select
                                value={compId}
                                onChange={(e) => setCompId(e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 py-2 text-sm focus:border-emerald-500 focus:outline-none appearance-none transition-all"
                            >
                                <option value="">No Company</option>
                                {companies.map((c) => (
                                    <option key={c.comp_id} value={c.comp_id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                        >
                            {isSubmitting ? 'Creating...' : 'Create Contact'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
