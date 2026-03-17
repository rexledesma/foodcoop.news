import webpush from 'web-push';
import { CRON_SECRET, VAPID_PRIVATE_KEY, VAPID_SUBJECT } from '$env/static/private';
import { PUBLIC_VAPID_PUBLIC_KEY } from '$env/static/public';

webpush.setVapidDetails(VAPID_SUBJECT, PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

type PushSubscriptionPayload = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

type SystemNotificationRequest = {
  title: string;
  body: string;
  url?: string;
  subscriptions: PushSubscriptionPayload[];
};

function isValidRequestBody(value: unknown): value is SystemNotificationRequest {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const maybe = value as {
    title?: unknown;
    body?: unknown;
    url?: unknown;
    subscriptions?: unknown;
  };

  if (typeof maybe.title !== 'string' || maybe.title.trim().length === 0) {
    return false;
  }

  if (typeof maybe.body !== 'string' || maybe.body.trim().length === 0) {
    return false;
  }

  if (maybe.url !== undefined && typeof maybe.url !== 'string') {
    return false;
  }

  if (!Array.isArray(maybe.subscriptions)) {
    return false;
  }

  return maybe.subscriptions.every((subscription) => {
    if (!subscription || typeof subscription !== 'object') {
      return false;
    }
    const candidate = subscription as {
      endpoint?: unknown;
      p256dh?: unknown;
      auth?: unknown;
    };

    return (
      typeof candidate.endpoint === 'string' &&
      candidate.endpoint.length > 0 &&
      typeof candidate.p256dh === 'string' &&
      candidate.p256dh.length > 0 &&
      typeof candidate.auth === 'string' &&
      candidate.auth.length > 0
    );
  });
}

export async function POST({ request }: { request: Request }) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isValidRequestBody(body)) {
    return Response.json({ error: 'Invalid request payload' }, { status: 400 });
  }

  const payload = JSON.stringify({
    title: body.title.trim(),
    body: body.body.trim(),
    url: body.url?.trim() || '/',
  });

  const results = await Promise.allSettled(
    body.subscriptions.map((sub) =>
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

  const sent = results.filter((result) => result.status === 'fulfilled').length;
  const failed = results.length - sent;

  if (failed > 0) {
    console.error('System notification push send failures:', { sent, failed });
  }

  return Response.json({ sent, failed });
}
