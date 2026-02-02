'use client';
import { BarChart3, Users, Briefcase, Settings, LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils'; // Assuming cn utility; using relative path or placeholder

const NAV_ITEMS = [
    { label: 'Dashboard', icon: BarChart3, href: '/dashboard' },
    { label: 'Deals', icon: Briefcase, href: '/deals' },
    { label: 'Contacts', icon: Users, href: '/contacts' },
    { label: 'Settings', icon: Settings, href: '/settings' },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <div className="flex h-full w-64 flex-col bg-slate-900 text-white">
            <div className="flex h-16 items-center border-b border-slate-700 px-6">
                <span className="text-xl font-bold tracking-tight text-emerald-400">GrowthEngine</span>
            </div>
            <div className="flex-1 py-6">
                <nav className="space-y-1 px-3">
                    {NAV_ITEMS.map((item) => (
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
                <button className="flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white">
                    <LogOut className="mr-3 h-5 w-5" />
                    Sign Out
                </button>
            </div>
        </div>
    );
}
