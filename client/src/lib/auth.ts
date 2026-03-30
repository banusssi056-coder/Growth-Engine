import { Amplify } from 'aws-amplify';

const isDefault = typeof window === 'undefined';
const origin = isDefault ? 'http://localhost:3000' : window.location.origin;

Amplify.configure({
    Auth: {
        Cognito: {
            userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
            userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
            loginWith: {
                oauth: {
                    domain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN!,
                    scopes: ['email', 'openid', 'profile'],
                    redirectSignIn: [`${origin}/dashboard`],
                    redirectSignOut: [`${origin}/login`],
                    responseType: 'code'
                }
            }
        }
    }
});
