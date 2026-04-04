import { api } from '@convex/_generated/api';
import type { Handle } from '@sveltejs/kit';

import { fetchAuthMutationFromHeaders } from '@/lib/auth';

const lastTouched = new Map<string, number>();
const THROTTLE_MS = 60 * 60 * 1000; // 1 hour
const MAX_ENTRIES = 1000;

function pruneStaleEntries(): void {
  if (lastTouched.size <= MAX_ENTRIES) return;
  const now = Date.now();
  for (const [key, timestamp] of lastTouched) {
    if (now - timestamp > THROTTLE_MS) {
      lastTouched.delete(key);
    }
  }
}

export const handle: Handle = async ({ event, resolve }) => {
  const sessionCookie = event.cookies.get('better-auth.session_token');

  if (sessionCookie) {
    const now = Date.now();
    const lastTime = lastTouched.get(sessionCookie) ?? 0;

    if (now - lastTime > THROTTLE_MS) {
      lastTouched.set(sessionCookie, now);
      pruneStaleEntries();

      void fetchAuthMutationFromHeaders(
        event.request.headers,
        api.memberProfiles.touchLastSeen,
        {},
      ).catch((error) => {
        console.error('touchLastSeen failed:', error);
        lastTouched.delete(sessionCookie!);
      });
    }
  }

  return resolve(event);
};
