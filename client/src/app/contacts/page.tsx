// Trigger redeploy for contacts fix
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Building, Trash2 } from 'lucide-react';
import { CreateCompanyModal } from '@/components/contacts/CreateCompanyModal';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function Contacts() {
    const [companies, setCompanies] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    useEffect(() => {
        fetchCompanies();
    }, []);

    const fetchCompanies = async () => {
        try {
            const { data, error } = await supabase
                .from('companies')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                setCompanies(data);
            }
        } catch (err) {
            console.error("Error loading companies", err);
            alert(`Failed to load companies: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };

    const handleNewCompany = (newCompany: any) => {
        setCompanies(prev => [newCompany, ...prev] as any);
    };

    const handleDeleteCompany = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete "${name}"? This will also remove associated deals and contacts.`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('companies')
                .delete()
                .eq('comp_id', id);

            if (error) throw error;

            setCompanies(prev => prev.filter(c => c.comp_id !== id));
        } catch (err) {
            console.error("Error deleting company", err);
            alert(`Failed to delete company: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
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
                                    <th className="px-6 py-3 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {companies.map((company: any) => (
                                    <tr key={company.comp_id} className="hover:bg-slate-50 group">
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
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleDeleteCompany(company.comp_id, company.name)}
                                                className="text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all p-2 rounded hover:bg-red-50"
                                                title="Delete Company"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {companies.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
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
