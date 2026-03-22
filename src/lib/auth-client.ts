import { convexClient } from '@convex-dev/better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

const client = createAuthClient({
  plugins: [convexClient()],
});

export const { signIn, signUp, signOut } = client;
