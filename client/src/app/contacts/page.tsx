'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Building } from 'lucide-react';
import { CreateCompanyModal } from '@/components/contacts/CreateCompanyModal';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function Contacts() {
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    useEffect(() => {
        fetchCompanies();
    }, []);

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
                }
            } catch (err) {
                console.error("Error loading companies", err);
            }
        }
        setLoading(false);
    };

    const handleNewCompany = (newCompany: any) => {
        setCompanies(prev => [newCompany, ...prev] as any);
    };

    return (
        <ProtectedRoute>
            <div className="flex flex-col h-full bg-slate-50 p-6 overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Contacts & Companies</h1>
                        <p className="text-sm text-slate-500">Manage your target accounts.</p>
                    </div>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
                    >
                        <Plus size={16} />
                        Add Company
                    </button>
                </div>

                <div className="flex-1 overflow-auto bg-white rounded-lg border border-slate-200 shadow-sm">
                    {loading ? (
                        <div className="p-6 text-center text-slate-500">Loading directory...</div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-3 font-semibold">Company</th>
                                    <th className="px-6 py-3 font-semibold">Industry</th>
                                    <th className="px-6 py-3 font-semibold">Revenue</th>
                                    <th className="px-6 py-3 font-semibold">Added</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {companies.map((company: any) => (
                                    <tr key={company.comp_id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-50 text-blue-600">
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
                                    </tr>
                                ))}
                                {companies.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                            No companies found. Create one to get started!
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                <CreateCompanyModal
                    isOpen={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                    onSuccess={handleNewCompany}
                />
            </div>
        </ProtectedRoute>
    );
}
