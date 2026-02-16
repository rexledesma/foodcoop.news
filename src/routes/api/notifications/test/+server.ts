import webpush from 'web-push';
import { fetchAuthQueryFromHeaders, isUnauthenticatedError } from '@/lib/auth';
import { api } from '../../../../../convex/_generated/api';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

export async function POST({ request }: { request: Request }) {
  try {
    const profile = await fetchAuthQueryFromHeaders(
      request.headers,
      api.memberProfiles.getMemberProfile,
      {},
    );

    if (!profile) {
      return Response.json({ error: 'Not authenticated or profile not found' }, { status: 401 });
    }

    const subscriptions = await fetchAuthQueryFromHeaders(
      request.headers,
      api.pushSubscriptions.getUserPushSubscriptionsWithKeys,
      {},
    );

    if (subscriptions.length === 0) {
      return Response.json({ error: 'No push subscriptions found' }, { status: 404 });
    }

    const payload = JSON.stringify({
      title: 'foodcoop.news',
      body: `Hey ${profile.memberName}! Notifications are working.`,
      url: '/integrations',
    });

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload,
        ),
      ),
    );

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return Response.json({ sent, failed });
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }
    console.error('Test notification error:', error);
    return Response.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}
