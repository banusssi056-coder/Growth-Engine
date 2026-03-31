'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAuthSession, getCurrentUser } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        // If Cognito redirected back with an OAuth error (e.g. phone_number required),
        // bail out immediately instead of hanging on auth check.
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const errorDesc = params.get('error_description') || params.get('error');
            if (errorDesc) {
                console.error('OAuth error detected in URL:', decodeURIComponent(errorDesc));
                router.push('/login?error=' + encodeURIComponent(decodeURIComponent(errorDesc)));
                return;
            }
        }

        const checkAuth = async () => {
            try {
                // Timeout after 10 seconds to avoid indefinite loading
                const authPromise = (async () => {
                    const user = await getCurrentUser();
                    const session = await fetchAuthSession();
                    return { user, session };
                })();

                const timeoutPromise = new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Auth check timed out')), 10000)
                );

                const { user, session } = await Promise.race([authPromise, timeoutPromise]);

                if (!user || !session.tokens?.idToken) {
                    router.push('/login');
                    return;
                }

                setIsAuthenticated(true);
            } catch (error) {
                console.error('Auth check failed:', error);
                router.push('/login');
            } finally {
                setIsLoading(false);
            }
        };

        checkAuth();

        // Listen for auth state changes using Amplify Hub
        const unsubscribe = Hub.listen('auth', ({ payload }) => {
            switch (payload.event) {
                case 'signedIn':
                    setIsAuthenticated(true);
                    break;
                case 'signedOut':
                    setIsAuthenticated(false);
                    router.push('/login');
                    break;
            }
        });

        return () => unsubscribe();
    }, [router]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-emerald-600 border-r-transparent"></div>
                    <p className="mt-4 text-slate-600">Verifying authentication (Cognito)...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null; // Will redirect to login
    }

    return <>{children}</>;
}
