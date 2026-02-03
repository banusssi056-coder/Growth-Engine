'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Download, Shield, ShieldAlert, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Settings() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const router = useRouter();

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        try {
            const res = await fetch('http://127.0.0.1:5000/api/users', {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (userId: string, newRole: string) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        try {
            const res = await fetch(`http://127.0.0.1:5000/api/users/${userId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ role: newRole })
            });
            if (res.ok) {
                setUsers(users.map(u => u.user_id === userId ? { ...u, role: newRole } : u));
            }
        } catch (err) {
            console.error(err);
        }
    };

    const toggleStatus = async (userId: string, currentStatus: boolean) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        try {
            const res = await fetch(`http://127.0.0.1:5000/api/users/${userId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ is_active: !currentStatus })
            });
            if (res.ok) {
                setUsers(users.map(u => u.user_id === userId ? { ...u, is_active: !currentStatus } : u));
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleExport = async () => {
        setExporting(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        try {
            const res = await fetch('http://127.0.0.1:5000/api/export/deals', {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });

            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `deals-export-${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                a.remove();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">System Settings</h1>
                    <p className="text-slate-500">Manage users, roles, and global configurations.</p>
                </div>
                <button
                    onClick={handleExport}
                    disabled={exporting}
                    className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 disabled:opacity-50"
                >
                    <Download size={18} />
                    {exporting ? 'Exporting...' : 'Export All Deals'}
                </button>
            </div>

            <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200">
                    <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                        <ShieldAlert className="text-emerald-600" size={20} />
                        User Management
                    </h2>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-600 font-medium">
                            <tr>
                                <th className="px-6 py-3">User</th>
                                <th className="px-6 py-3">Role</th>
                                <th className="px-6 py-3">Reports To</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3">Joined</th>
                                <th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {users.map((u) => (
                                <tr key={u.user_id} className="hover:bg-slate-50">
                                    <td className="px-6 py-3 font-medium text-slate-900">{u.email}</td>
                                    <td className="px-6 py-3">
                                        <select
                                            value={u.role}
                                            onChange={(e) => handleRoleChange(u.user_id, e.target.value)}
                                            className={cn(
                                                "border-none bg-transparent font-medium focus:ring-0 cursor-pointer rounded-md py-1 px-2",
                                                u.role === 'admin' ? "text-purple-600 bg-purple-50" :
                                                    u.role === 'manager' ? "text-blue-600 bg-blue-50" :
                                                        "text-slate-600"
                                            )}
                                        >
                                            <option value="admin">Admin</option>
                                            <option value="manager">Manager</option>
                                            <option value="rep">Sales Rep</option>
                                            <option value="intern">Intern</option>
                                        </select>
                                    </td>
                                    <td className="px-6 py-3">
                                        <select
                                            value={u.manager_id || ''}
                                            onChange={async (e) => {
                                                const newManagerId = e.target.value || null;
                                                const { data: { session } } = await supabase.auth.getSession();
                                                if (!session) return;
                                                // Assuming API endpoint handles manager_id update
                                                await fetch(`http://127.0.0.1:5000/api/users/${u.user_id}`, {
                                                    method: 'PATCH',
                                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                                                    body: JSON.stringify({ manager_id: newManagerId })
                                                });
                                                setUsers(users.map(user => user.user_id === u.user_id ? { ...user, manager_id: newManagerId } : user));
                                            }}
                                            className="border border-slate-200 rounded text-sm px-2 py-1 w-32"
                                        >
                                            <option value="">-- None --</option>
                                            {/* Filtering logic: Only show Managers/Admins as options */}
                                            {users.filter(m => (m.role === 'admin' || m.role === 'manager') && m.user_id !== u.user_id).map(m => (
                                                <option key={m.user_id} value={m.user_id}>{m.email}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-6 py-3">
                                        <span className={cn(
                                            "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                                            u.is_active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                                        )}>
                                            {u.is_active ? 'Active' : 'Disabled'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-slate-500">
                                        {new Date(u.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-3 text-right">
                                        <button
                                            onClick={() => toggleStatus(u.user_id, u.is_active)}
                                            className="text-slate-400 hover:text-red-600 text-xs underline"
                                        >
                                            {u.is_active ? 'Disable' : 'Enable'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {users.length === 0 && !loading && (
                        <div className="p-8 text-center text-slate-500">No users found.</div>
                    )}
                </div>
            </div>
        </div>
    );
}
