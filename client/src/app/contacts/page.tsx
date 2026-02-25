// Trigger redeploy for contacts fix
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Building, User, Mail, Phone, Trash2 } from 'lucide-react';
import { CreateCompanyModal } from '@/components/contacts/CreateCompanyModal';
import { CreateContactModal } from '@/components/contacts/CreateContactModal';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function Contacts() {
    const [activeTab, setActiveTab] = useState<'companies' | 'contacts'>('companies');
    const [companies, setCompanies] = useState<any[]>([]);
    const [contacts, setContacts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<string>('rep');
    const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);

    useEffect(() => {
        fetchUser();
        if (activeTab === 'companies') {
            fetchCompanies();
        } else {
            fetchContacts();
        }
    }, [activeTab]);

    const fetchUser = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/me`, {
                    headers: { Authorization: `Bearer ${session.access_token}` }
                });
                if (res.ok) {
                    const user = await res.json();
                    setUserRole(user.role);
                }
            }
        } catch (err) {
            console.error("Error fetching user role", err);
        }
    };

    const fetchCompanies = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('companies')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setCompanies(data || []);
        } catch (err) {
            console.error("Error loading companies", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchContacts = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('contacts')
                .select(`
                    *,
                    companies (name)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setContacts(data || []);
        } catch (err) {
            console.error("Error loading contacts", err);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteContact = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete contact "${name}"?`)) return;
        try {
            const { error } = await supabase.from('contacts').delete().eq('cont_id', id);
            if (error) throw error;
            setContacts(prev => prev.filter(c => c.cont_id !== id));
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleDeleteCompany = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete "${name}"? This will also remove associated deals and contacts.`)) return;
        try {
            const { error } = await supabase.from('companies').delete().eq('comp_id', id);
            if (error) throw error;
            setCompanies(prev => prev.filter(c => c.comp_id !== id));
        } catch (err: any) {
            alert(err.message);
        }
    };

    return (
        <ProtectedRoute>
            <div className="flex flex-col h-full bg-slate-50 p-6 overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Directory</h1>
                        <p className="text-sm text-slate-500">Manage your companies and individual contacts.</p>
                    </div>
                    <div className="flex gap-2">
                        {activeTab === 'companies' ? (
                            <button
                                onClick={() => setIsCompanyModalOpen(true)}
                                className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
                            >
                                <Plus size={16} />
                                Add Company
                            </button>
                        ) : (
                            <button
                                onClick={() => setIsContactModalOpen(true)}
                                className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
                            >
                                <Plus size={16} />
                                Add Contact
                            </button>
                        )}
                    </div>
                </div>

                {/* Tab Switcher */}
                <div className="flex border-b border-slate-200 mb-6">
                    <button
                        onClick={() => setActiveTab('companies')}
                        className={`px-6 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'companies'
                            ? 'border-emerald-600 text-emerald-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Companies
                    </button>
                    <button
                        onClick={() => setActiveTab('contacts')}
                        className={`px-6 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'contacts'
                            ? 'border-emerald-600 text-emerald-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Contacts
                    </button>
                </div>

                <div className="flex-1 overflow-auto bg-white rounded-lg border border-slate-200 shadow-sm">
                    {loading ? (
                        <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-4 border-emerald-600/20 border-t-emerald-600 rounded-full animate-spin"></div>
                            Loading directory...
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0 z-10">
                                {activeTab === 'companies' ? (
                                    <tr>
                                        <th className="px-6 py-3 font-semibold text-xs uppercase tracking-wider">Company</th>
                                        <th className="px-6 py-3 font-semibold text-xs uppercase tracking-wider">Industry</th>
                                        <th className="px-6 py-3 font-semibold text-xs uppercase tracking-wider">Revenue</th>
                                        <th className="px-6 py-3 font-semibold text-xs uppercase tracking-wider">Added</th>
                                        <th className="px-6 py-3 font-semibold text-xs uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                ) : (
                                    <tr>
                                        <th className="px-6 py-3 font-semibold text-xs uppercase tracking-wider">Name</th>
                                        <th className="px-6 py-3 font-semibold text-xs uppercase tracking-wider">Company</th>
                                        <th className="px-6 py-3 font-semibold text-xs uppercase tracking-wider">Email</th>
                                        <th className="px-6 py-3 font-semibold text-xs uppercase tracking-wider">Phone</th>
                                        <th className="px-6 py-3 font-semibold text-xs uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                )}
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {activeTab === 'companies' ? (
                                    companies.map((company: any) => (
                                        <tr key={company.comp_id} className="hover:bg-slate-50 group transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-50 text-blue-600 border border-blue-100">
                                                        <Building size={16} />
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-slate-900">{company.name}</div>
                                                        <div className="text-xs text-slate-500">{company.domain}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">{company.industry || '-'}</td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {company.revenue ? `$${Number(company.revenue).toLocaleString()}` : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-500">
                                                {new Date(company.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {userRole !== 'intern' && (
                                                    <button
                                                        onClick={() => handleDeleteCompany(company.comp_id, company.name)}
                                                        className="text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all p-2 rounded hover:bg-red-50"
                                                        title="Delete Company"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    contacts.map((contact: any) => (
                                        <tr key={contact.cont_id} className="hover:bg-slate-50 group transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-8 w-8 items-center justify-center rounded bg-emerald-50 text-emerald-600 border border-emerald-100 font-bold text-xs">
                                                        {contact.first_name[0]}{contact.last_name[0]}
                                                    </div>
                                                    <div className="font-medium text-slate-900">{contact.first_name} {contact.last_name}</div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {contact.companies?.name || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                <div className="flex items-center gap-1.5 hover:text-emerald-600 cursor-pointer transition-colors">
                                                    <Mail size={12} />
                                                    {contact.email}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {contact.phone ? (
                                                    <div className="flex items-center gap-1.5 transition-colors">
                                                        <Phone size={12} className="text-slate-400" />
                                                        {contact.phone}
                                                    </div>
                                                ) : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {userRole !== 'intern' && (
                                                    <button
                                                        onClick={() => handleDeleteContact(contact.cont_id, `${contact.first_name} ${contact.last_name}`)}
                                                        className="text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all p-2 rounded hover:bg-red-50"
                                                        title="Delete Contact"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}

                                {((activeTab === 'companies' && companies.length === 0) || (activeTab === 'contacts' && contacts.length === 0)) && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-24 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mb-2">
                                                    {activeTab === 'companies' ? <Building size={24} /> : <User size={24} />}
                                                </div>
                                                <div className="text-slate-800 font-medium">No {activeTab} yet</div>
                                                <div className="text-slate-500 text-xs">Click the button above to add your first {activeTab === 'companies' ? 'company' : 'contact'}.</div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                <CreateCompanyModal
                    isOpen={isCompanyModalOpen}
                    onClose={() => setIsCompanyModalOpen(false)}
                    onSuccess={fetchCompanies}
                />

                <CreateContactModal
                    isOpen={isContactModalOpen}
                    onClose={() => setIsContactModalOpen(false)}
                    onSuccess={fetchContacts}
                />
            </div>
        </ProtectedRoute>
    );
}
