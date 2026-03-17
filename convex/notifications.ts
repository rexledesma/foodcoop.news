import { components, internal } from './_generated/api';
import { httpAction, type ActionCtx } from './_generated/server';

const cronSecret = process.env.CRON_SECRET;

type NotificationPayload = {
  title: string;
  body: string;
  url?: string;
};

type PushSubscriptionWithKeys = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

function parseAllowedNotificationEmails(): string[] {
  return (process.env.PUBLIC_NOTIFICATIONS_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((email): string => email.trim())
    .filter(Boolean);
}

function isNotificationPayload(value: unknown): value is NotificationPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as {
    title?: unknown;
    body?: unknown;
    url?: unknown;
  };

  if (typeof payload.title !== 'string' || payload.title.trim().length === 0) {
    return false;
  }
  if (typeof payload.body !== 'string' || payload.body.trim().length === 0) {
    return false;
  }
  if (payload.url !== undefined && typeof payload.url !== 'string') {
    return false;
  }
  return true;
}

async function getAllowedPushSubscriptions(
  ctx: ActionCtx,
): Promise<{ subscriptions: PushSubscriptionWithKeys[]; reason?: string }> {
  const allowedEmails = parseAllowedNotificationEmails();
  if (allowedEmails.length === 0) {
    return { subscriptions: [], reason: 'no_allowed_emails' };
  }

  const userIds = new Set<string>();
  for (const email of allowedEmails) {
    const user = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: 'user',
      where: [{ field: 'email', operator: 'eq', value: email }],
    });
    if (user) {
      userIds.add((user as { _id: string })._id);
    }
  }

  if (userIds.size === 0) {
    return { subscriptions: [], reason: 'no_matching_users' };
  }

  const subscriptions = await ctx.runQuery(
    internal.pushSubscriptions.getPushSubscriptionsByUserIds,
    {
      userIds: Array.from(userIds),
    },
  );
  if (subscriptions.length === 0) {
    return { subscriptions: [], reason: 'no_push_subscriptions' };
  }
  return { subscriptions };
}

async function resolveAllowedUsersNotificationTargets(
  ctx: ActionCtx,
  payload: NotificationPayload,
): Promise<{ subscriptions?: PushSubscriptionWithKeys[]; skipped?: boolean; reason?: string }> {
  void payload;
  if (!cronSecret) {
    console.warn('Notification dispatch skipped: missing CRON_SECRET.');
    return { skipped: true, reason: 'missing_cron_secret' };
  }

  const { subscriptions, reason } = await getAllowedPushSubscriptions(ctx);
  if (subscriptions.length === 0) {
    return { skipped: true, reason };
  }

  return { subscriptions };
}

export const notifyAllowedUsersHttp = httpAction(async (ctx, request) => {
  if (!cronSecret) {
    return Response.json({ error: 'Server is missing CRON_SECRET' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isNotificationPayload(body)) {
    return Response.json({ error: 'Invalid request payload' }, { status: 400 });
  }

  const result = await resolveAllowedUsersNotificationTargets(ctx, {
    title: body.title.trim(),
    body: body.body.trim(),
    url: body.url?.trim() || '/',
  });
  return Response.json(result);
});
