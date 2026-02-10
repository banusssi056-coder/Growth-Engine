'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
    const [status, setStatus] = useState('Processing authentication...');
    const router = useRouter();

    useEffect(() => {
        const handleCallback = async () => {
            try {
                // Get the current session from Supabase
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError || !session) {
                    console.error('Session error:', sessionError);
                    setStatus('Authentication failed. Redirecting to login...');
                    setTimeout(() => router.push('/login'), 2000);
                    return;
                }

                setStatus('Fetching user profile...');

                // Fetch user profile and role from backend with timeout
                let user = null;
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

                    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/me`, {
                        headers: {
                            'Authorization': `Bearer ${session.access_token}`
                        },
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);

                    if (response.ok) {
                        user = await response.json();
                        console.log('User profile loaded:', user);
                        // Store user data in sessionStorage for immediate access
                        sessionStorage.setItem('userProfile', JSON.stringify(user));
                    } else {
                        console.error('Failed to fetch user profile:', response.status);
                    }
                } catch (fetchError: any) {
                    console.error('Error fetching user profile:', fetchError.message);
                    // Continue without profile - will use default dashboard
                }

                // Determine redirect path based on role (if available)
                let redirectPath = '/dashboard'; // Default fallback

                if (user?.role) {
                    setStatus(`Welcome! Redirecting to your ${user.role} dashboard...`);

                    switch (user.role.toLowerCase()) {
                        case 'admin':
                            redirectPath = '/admin/dashboard';
                            break;
                        case 'manager':
                            redirectPath = '/manager/dashboard';
                            break;
                        case 'rep':
                        case 'intern':
                        default:
                            redirectPath = '/dashboard';
                            break;
                    }
                } else {
                    setStatus('Welcome! Redirecting to dashboard...');
                }

                // Redirect immediately (no delay needed)
                router.push(redirectPath);

            } catch (error) {
                console.error('Auth callback error:', error);
                setStatus('An error occurred. Redirecting to dashboard...');
                // Even on error, redirect to dashboard instead of login
                setTimeout(() => router.push('/dashboard'), 1500);
            }
        };

        handleCallback();
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
            <div className="max-w-md w-full text-center p-8 bg-white rounded-xl shadow-lg border border-slate-200">
                <div className="mb-6">
                    <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-emerald-600 border-r-transparent"></div>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-3">Authentication in Progress</h2>
                <p className="text-slate-600">{status}</p>
            </div>
        </div>
    );
}
