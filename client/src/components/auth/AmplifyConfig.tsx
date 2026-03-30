'use client';

import { Amplify } from 'aws-amplify';

if (typeof window !== 'undefined') {
    Amplify.configure({
        Auth: {
            Cognito: {
                userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
                userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
                loginWith: {
                    oauth: {
                        domain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN!,
                        scopes: ['email', 'openid', 'profile'],
                        redirectSignIn: [`${window.location.origin}/dashboard`],
                        redirectSignOut: [`${window.location.origin}/login`],
                        responseType: 'code'
                    }
                }
            }
        }
    }, { ssr: true });
}

export default function AmplifyConfig({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
