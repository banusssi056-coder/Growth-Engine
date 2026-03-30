import { fetchAuthSession, getCurrentUser, signOut } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';

// This is a shim to maintain compatibility with existing code while migrating to Cognito
export const supabase: any = {
    auth: {
        getSession: async () => {
            try {
                const session = await fetchAuthSession();
                const token = session.tokens?.idToken?.toString();
                if (!token) return { data: { session: null }, error: null };
                
                return { 
                    data: { 
                        session: { 
                            access_token: token,
                            user: { email: session.tokens?.idToken?.payload.email }
                        } 
                    }, 
                    error: null 
                };
            } catch (err) {
                return { data: { session: null }, error: err };
            }
        },
        getUser: async () => {
            try {
                const user = await getCurrentUser();
                const session = await fetchAuthSession();
                return { 
                    data: { 
                        user: { 
                            id: user.userId, 
                            email: session.tokens?.idToken?.payload.email 
                        } 
                    }, 
                    error: null 
                };
            } catch (err) {
                return { data: { user: null }, error: err };
            }
        },
        signOut: async () => {
            await signOut();
        },
        onAuthStateChange: (callback: any) => {
            const unsubscribe = Hub.listen('auth', ({ payload }) => {
                const { event } = payload;
                if (event === 'signedIn' || event === 'signedOut') {
                    // We can't easily get the session sync here without async
                    // but most components call getSession anyway.
                    // For a shim, we might just pass a dummy session or null.
                    callback(event, null); 
                }
            });
            return { data: { subscription: { unsubscribe } } };
        }
    },
    // Add dummy from() to avoid crashes if any were missed, though we aim to remove them
    from: () => ({
        select: () => ({
            eq: () => ({
                single: () => Promise.resolve({ data: null, error: new Error("Direct Supabase DB access is deprecated. Use API.") })
            })
        })
    })
};
