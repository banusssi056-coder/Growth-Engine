import { fetchAuthSession, getCurrentUser } from 'aws-amplify/auth';

export async function getAuthToken() {
    try {
        const session = await fetchAuthSession();
        return session.tokens?.idToken?.toString();
    } catch (err) {
        console.error('Error getting auth token:', err);
        return null;
    }
}

export async function getAuthenticatedUser() {
    try {
        return await getCurrentUser();
    } catch (err) {
        return null;
    }
}
