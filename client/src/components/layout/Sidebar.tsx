'use client';
import { BarChart3, Users, Briefcase, Settings, LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

export function Sidebar() {
    const pathname = usePathname();
    const [user, setUser] = useState<any>(null);
    const router = useRouter();

    const fetchUser = async (session: any) => {
        if (!session?.access_token) {
            setUser(null);
            return;
        }

        // Check sessionStorage first for immediate display
        try {
            const cachedUser = sessionStorage.getItem('userProfile');
            if (cachedUser) {
                const parsedUser = JSON.parse(cachedUser);
                setUser(parsedUser);
                console.log('[Sidebar] Loaded user from cache:', parsedUser);
            }
        } catch (err) {
            console.error('Error loading cached user:', err);
        }

        // Then fetch fresh data from API
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/me`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });
            if (res.ok) {
                const fullUser = await res.json();
                setUser(fullUser);
                // Update cache
                sessionStorage.setItem('userProfile', JSON.stringify(fullUser));
                console.log('[Sidebar] Fetched fresh user data:', fullUser);
            } else {
                console.error('Failed to fetch user:', res.status, res.statusText);
            }
        } catch (err) {
            console.error("Error fetching user profile", err);
        }
    };

    useEffect(() => {
        // Initial check
        supabase.auth.getSession().then(({ data: { session } }) => {
            fetchUser(session);
        });

        // Listen for changes (Sign In / Sign Out)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            fetchUser(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleSignOut = async () => {
        // Clear cached user data
        sessionStorage.removeItem('userProfile');
        await supabase.auth.signOut();
        router.push('/login');
    };

    // Dynamically determine dashboard link based on user role
    const navItems = useMemo(() => {
        let dashboardHref = '/dashboard'; // Default

        if (user?.role === 'admin') {
            dashboardHref = '/admin/dashboard';
        } else if (user?.role === 'manager') {
            dashboardHref = '/manager/dashboard';
        }

        return [
            { label: 'Dashboard', icon: BarChart3, href: dashboardHref },
            { label: 'Deals', icon: Briefcase, href: '/deals' },
            { label: 'Contacts', icon: Users, href: '/contacts' },
            { label: 'Settings', icon: Settings, href: '/settings' },
        ];
    }, [user?.role]);

    return (
        <div className="flex h-full w-64 flex-col bg-slate-900 text-white">
            <div className="flex h-16 items-center border-b border-slate-700 px-6">
                <span className="text-xl font-bold tracking-tight text-emerald-400">GrowthEngine</span>
            </div>
            <div className="flex-1 py-6">
                <nav className="space-y-1 px-3">
                    {navItems.filter((item) => {
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
                    <div className="flex items-center mb-4 px-2">
                        <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center text-sm font-bold text-white mr-3">
                            {user.email?.charAt(0).toUpperCase()}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-medium text-white truncate">{user.email}</p>
                        </div>
                    </div>
                )}
                <button
                    onClick={handleSignOut}
                    className="flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                    <LogOut className="mr-3 h-5 w-5" />
                    Sign Out
                </button>
            </div>
        </div>
    );
}
