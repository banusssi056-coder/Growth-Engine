'use client';
import { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/auth-utils';
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
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        if (isOpen) {
            fetchCompanies();
        }
    }, [isOpen]);

    const fetchCompanies = async () => {
        try {
            const token = await getAuthToken();
            if (!token) return;
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/companies`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setCompanies(data);
            }
        } catch (err) {
            console.error("Error fetching companies", err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const token = await getAuthToken();
            if (!token) throw new Error('No active session');

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/contacts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    first_name: firstName,
                    last_name: lastName,
                    email,
                    phone: phone || null,
                    job_title: jobTitle || null,
                    comp_id: compId || null,
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Failed to create contact');
            }

            const data = await res.json();
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
                                type="text"
                                value={firstName}
                                onChange={(e) => {
                                    setFirstName(e.target.value);
                                    if (errors.firstName) setErrors(prev => ({ ...prev, firstName: '' }));
                                }}
                                pattern="[A-Za-z]+"
                                onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Please use only letters (no spaces or numbers)')}
                                onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none transition-all"
                                placeholder="John"
                            />
                            {errors.firstName && <p className="text-[10px] text-red-500">{errors.firstName}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Name</label>
                            <input
                                type="text"
                                value={lastName}
                                onChange={(e) => {
                                    setLastName(e.target.value);
                                    if (errors.lastName) setErrors(prev => ({ ...prev, lastName: '' }));
                                }}
                                pattern="[A-Za-z]+"
                                onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Please use only letters (no spaces or numbers)')}
                                onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none transition-all"
                                placeholder="Doe"
                            />
                            {errors.lastName && <p className="text-[10px] text-red-500">{errors.lastName}</p>}
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
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone (10 digits)</label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => {
                                    setPhone(e.target.value);
                                    if (errors.phone) setErrors(prev => ({ ...prev, phone: '' }));
                                }}
                                pattern="[0-9]{10}"
                                onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Please enter exactly 10 digits')}
                                onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none transition-all"
                                placeholder="9876543210"
                            />
                            {errors.phone && <p className="text-[10px] text-red-500">{errors.phone}</p>}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
                                }}
                                onInvalid={(e) => {
                                    if (!(e.target as HTMLInputElement).validity.valid) {
                                        (e.target as HTMLInputElement).setCustomValidity('Please enter a valid email address (e.g. name@example.com)');
                                    }
                                }}
                                onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 py-2 text-sm focus:border-emerald-500 focus:outline-none transition-all"
                                placeholder="john.doe@gmail.com"
                            />
                        </div>
                        {errors.email && <p className="text-[10px] text-red-500">{errors.email}</p>}
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
