'use client';
import { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/auth-utils';
import { useRouter } from 'next/navigation';
import { Download, Shield, ShieldAlert, Check, X, Layers, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { StageManager } from '@/components/kanban/StageManager';
import { WorkflowBuilder } from '@/components/kanban/WorkflowBuilder';

interface User {
    user_id: string;
    email: string;
    role: string;
    manager_id?: string;
    is_active: boolean;
    assignment_weight?: number;
    created_at: string;
}

export default function Settings() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [userRole, setUserRole] = useState<string>('rep');
    const router = useRouter();

    useEffect(() => {
        fetchUsers();
        fetchMyRole();
    }, []);

    const fetchMyRole = async () => {
        try {
            const token = await getAuthToken();
            if (!token) return;
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) { const me = await res.json(); setUserRole(me.role); }
        } catch { /* ignore */ }
    };

    const fetchUsers = async () => {
        try {
            const token = await getAuthToken();
            if (!token) return;
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Failed to fetch users");
            const data = await res.json();
            setUsers(data);
        } catch (err) {
            console.error("Error loading users", err);
            alert(`Failed to load users: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (userId: string, newRole: string) => {
        const token = await getAuthToken();
        if (!token) return;
 
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${userId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
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

    const handleManagerChange = async (userId: string, newManagerId: string) => {
        const token = await getAuthToken();
        if (!token) return;
 
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${userId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ manager_id: newManagerId || null })
            });
 
            if (res.ok) {
                setUsers(users.map(user => user.user_id === userId ? { ...user, manager_id: newManagerId } : user));
            } else {
                const err = await res.json();
                alert(`Failed to update manager: ${err.error || 'Unknown error'}`);
            }
        } catch (err) {
            console.error(err);
            alert('Failed to connect to server');
        }
    }

    const toggleStatus = async (userId: string, currentStatus: boolean) => {
        const token = await getAuthToken();
        if (!token) return;
 
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${userId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
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

    const handleWeightChange = async (userId: string, weight: number) => {
        const token = await getAuthToken();
        if (!token) return;
 
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${userId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ assignment_weight: weight })
            });
 
            if (res.ok) {
                setUsers(users.map(u => u.user_id === userId ? { ...u, assignment_weight: weight } : u));
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleExport = async () => {
        setExporting(true);
        const token = await getAuthToken();
        if (!token) return;
 
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/export/deals`, {
                headers: { 'Authorization': `Bearer ${token}` }
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
        <ProtectedRoute>
            <div className="min-h-full bg-slate-50 flex flex-col">
                <header className="bg-white border-b border-slate-200 px-6 py-10 bg-gradient-to-r from-white to-slate-50">
                    <div className="flex justify-between items-center max-w-full">
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Control Center</h1>
                            <p className="text-slate-500 font-medium mt-1">Manage infrastructure, user permissions, and deployment parameters.</p>
                        </div>
                        <button
                            onClick={handleExport}
                            disabled={exporting}
                            className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50"
                        >
                            <Download size={20} />
                            {exporting ? 'Exporting...' : 'Export Platform Data'}
                        </button>
                    </div>
                </header>

                <div className="p-4 md:p-8 space-y-8">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="px-6 py-6 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                                <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                                    <Shield size={20} />
                                </div>
                                Identity & Access Management
                            </h2>
                            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full uppercase tracking-widest">
                                {users.length} Active Accounts
                            </span>
                        </div>

                        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] custom-scrollbar">
                            <table className="w-full text-left text-sm relative min-w-[1000px] border-separate border-spacing-0">
                                <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0 z-20 shadow-sm">
                                    <tr>
                                        <th className="px-6 py-4 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200 sticky left-0 z-30 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">User</th>
                                        <th className="px-6 py-4 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200">Role</th>
                                        <th className="px-6 py-4 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200">Reports To</th>
                                        <th className="px-6 py-4 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200">Weight (RR)</th>
                                        <th className="px-6 py-4 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200">Status</th>
                                        <th className="px-6 py-4 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200">Joined</th>
                                        <th className="px-6 py-4 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {users.map((u) => (
                                        <tr key={u.user_id} className="hover:bg-slate-50 group">
                                            <td className="px-6 py-3 font-medium text-slate-900 sticky left-0 z-10 bg-white group-hover:bg-slate-50 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">{u.email}</td>
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
                                                    onChange={(e) => handleManagerChange(u.user_id, e.target.value)}
                                                    className="border border-slate-200 rounded text-sm px-2 py-1 w-48"
                                                >
                                                    <option value="">-- None --</option>
                                                    {users.filter(m => (m.role === 'admin' || m.role === 'manager') && m.user_id !== u.user_id).map(m => (
                                                        <option key={m.user_id} value={m.user_id}>{m.email}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-6 py-3">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="10"
                                                    value={u.assignment_weight || 1}
                                                    onChange={(e) => handleWeightChange(u.user_id, parseInt(e.target.value) || 1)}
                                                    className="w-16 border border-slate-200 rounded text-sm px-2 py-1 text-center font-mono"
                                                />
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

                    {/* ───────────────── Pipeline Stage Manager (admin only) ── */}
                    {userRole === 'admin' && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-8">
                            <div className="px-6 py-6 border-b border-slate-100">
                                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                                    <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                                        <Layers size={20} />
                                    </div>
                                    Pipeline Stage Configuration
                                </h2>
                                <p className="text-sm text-slate-500 mt-1 ml-11">
                                    Add, rename, reorder or remove Kanban pipeline stages. Changes take effect immediately.
                                </p>
                            </div>
                            <div className="p-6">
                                <StageManager />
                            </div>
                        </div>
                    )}

                    {/* ───────────────── Workflow Builder (admin only) ── */}
                    {userRole === 'admin' && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-8">
                            <div className="px-6 py-6 border-b border-slate-100">
                                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                                    <div className="p-2 bg-violet-100 rounded-lg text-violet-600">
                                        <Zap size={20} />
                                    </div>
                                    Workflow Automation Rules
                                </h2>
                                <p className="text-sm text-slate-500 mt-1 ml-11">
                                    Define conditional logic to automate deal tasks based on field values and statuses.
                                </p>
                            </div>
                            <div className="p-6">
                                <WorkflowBuilder />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </ProtectedRoute>
    );
}
