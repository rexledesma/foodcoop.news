import { createAuthClient } from 'better-auth/react';
import { convexClient } from '@convex-dev/better-auth/client/plugins';

const client = createAuthClient({
  plugins: [convexClient()],
});

export const { signIn, signUp, signOut } = client;
