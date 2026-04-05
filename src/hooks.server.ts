import { api } from '@convex/_generated/api';
import type { Handle } from '@sveltejs/kit';

import { fetchAuthMutationFromHeaders } from '@/lib/auth';

export const handle: Handle = async ({ event, resolve }) => {
  const sessionCookie =
    event.cookies.get('__Secure-better-auth.session_token') ??
    event.cookies.get('better-auth.session_token');

  if (sessionCookie) {
    try {
      await fetchAuthMutationFromHeaders(
        event.request.headers,
        api.memberProfiles.touchLastSeen,
        {},
      );
    } catch (error) {
      console.error('touchLastSeen failed:', error);
    }
  }

  return resolve(event);
};
