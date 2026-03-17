import webpush from 'web-push';
import { z } from 'zod';
import { parseJsonBody, validatedJson } from '@/lib/http-validation';
import { CRON_SECRET, VAPID_PRIVATE_KEY, VAPID_SUBJECT } from '$env/static/private';
import { PUBLIC_VAPID_PUBLIC_KEY } from '$env/static/public';

webpush.setVapidDetails(VAPID_SUBJECT, PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const pushSubscriptionSchema = z.object({
  endpoint: z.string().min(1),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
});

const systemNotificationRequestSchema = z.object({
  title: z.string().trim().min(1),
  body: z.string().trim().min(1),
  url: z.string().optional(),
  subscriptions: z.array(pushSubscriptionSchema),
});

const systemNotificationResponseSchema = z.object({
  sent: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});

export async function POST({ request }: { request: Request }) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = await parseJsonBody(request, systemNotificationRequestSchema);
  if (!parsed.success) {
    return parsed.response;
  }
  const body = parsed.data;

  const payload = JSON.stringify({
    title: body.title,
    body: body.body,
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

  return validatedJson(systemNotificationResponseSchema, { sent, failed });
}
