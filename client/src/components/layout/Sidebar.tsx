'use client';
import { BarChart3, Users, Briefcase, Settings, LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { SearchTriggerButton } from './GlobalSearch';
import { NotificationBell } from './NotificationBell';

const NAV_ITEMS = [
    { label: 'Dashboard', icon: BarChart3, href: '/dashboard' },
    { label: 'Deals', icon: Briefcase, href: '/deals' },
    { label: 'Contacts', icon: Users, href: '/contacts' },
    { label: 'Settings', icon: Settings, href: '/settings' },
];

export function Sidebar() {
    const pathname = usePathname();
    const [user, setUser] = useState<any>(null);
    const [searchOpen, setSearchOpen] = useState(false);
    const router = useRouter();


    const fetchUser = async () => {
        try {
            // Get the authenticated user
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                setUser(null);
                return;
            }

            // Fetch the user profile from the users table
            const { data: profile, error } = await supabase
                .from('users')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (error) {
                console.error('Error fetching user profile:', error);
                // Fallback to basic user data from auth
                setUser({
                    user_id: user.id,
                    email: user.email,
                    full_name: user.email?.split('@')[0],
                    role: 'rep'
                });
            } else {
                setUser(profile);
            }
        } catch (err) {
            console.error("Error fetching user profile", err);
        }
    };

    useEffect(() => {
        // Initial check
        fetchUser();

        // Listen for changes (Sign In / Sign Out)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) {
                fetchUser();
            } else {
                setUser(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    return (
        <div className="flex h-full w-64 flex-col bg-slate-900 text-white">
            <div className="flex h-16 items-center justify-between border-b border-slate-700 px-4">
                <span className="text-xl font-bold tracking-tight text-emerald-400">GrowthEngine</span>
                <NotificationBell />
            </div>
            <div className="flex-1 py-4">
                <nav className="space-y-1 px-3">
                    {/* Search trigger — opens Ctrl+K command palette */}
                    <SearchTriggerButton onClick={() => {
                        // Dispatch a synthetic Ctrl+K to open the GlobalSearchProvider modal
                        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
                    }} />
                    <div className="my-2 border-t border-slate-700/50" />
                    {NAV_ITEMS.filter(item => {
                        if (item.label === 'Settings' && user?.role !== 'admin') return false;
                        return true;
                    }).map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-slate-800",
                                pathname === item.href ? "bg-slate-800 text-emerald-400" : "text-slate-300"
                            )}
                        >
                            <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                            {item.label}
                        </Link>
                    ))}
                </nav>
            </div>
            <div className="border-t border-slate-700 p-4">
                {user && (
                    <div className="mb-4 px-2">
                        <div className="flex items-start space-x-3">
                            {/* Avatar */}
                            <div className="relative flex-shrink-0">
                                {user.avatar_url ? (
                                    <img
                                        src={user.avatar_url}
                                        alt={user.full_name || user.email}
                                        className="h-10 w-10 rounded-full object-cover ring-2 ring-emerald-500/20"
                                    />
                                ) : (
                                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-sm font-bold text-white ring-2 ring-emerald-500/20 shadow-lg">
                                        {(user.full_name || user.email)?.charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>

                            {/* User Info */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white truncate">
                                    {user.full_name || user.email?.split('@')[0] || 'User'}
                                </p>
                                <p className="text-xs text-slate-400 truncate">{user.email}</p>
                                {user.role && (
                                    <span
                                        className={cn(
                                            "inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded",
                                            user.role === 'admin' && "bg-purple-500/20 text-purple-300",
                                            user.role === 'manager' && "bg-blue-500/20 text-blue-300",
                                            user.role === 'rep' && "bg-emerald-500/20 text-emerald-300",
                                            user.role === 'intern' && "bg-amber-500/20 text-amber-300"
                                        )}
                                    >
                                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                <button
                    onClick={handleSignOut}
                    className="flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                >
                    <LogOut className="mr-3 h-5 w-5" />
                    Sign Out
                </button>
            </div>
        </div>
    );
}
