import { CRON_SECRET } from '$env/static/private';
import { PUBLIC_CONVEX_SITE_URL } from '$env/static/public';

type OpsNotification = {
  title: string;
  body: string;
  url?: string;
};

const notifyAllowedUsersPath = '/notify-allowed-users';
const systemNotificationsPath = '/api/notifications/system';

type PushSubscriptionPayload = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

type NotifyAllowedUsersResponse = {
  subscriptions?: PushSubscriptionPayload[];
  skipped?: boolean;
  reason?: string;
};

export async function sendOpsNotification(
  payload: OpsNotification,
  request: Request,
): Promise<void> {
  if (!CRON_SECRET) {
    console.warn('Ops notification skipped: missing CRON_SECRET.');
    return;
  }

  const response = await fetch(`${PUBLIC_CONVEX_SITE_URL}${notifyAllowedUsersPath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CRON_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url ?? '/',
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Ops notification request failed (${response.status}): ${responseText}`);
  }

  const resolved = (await response.json()) as NotifyAllowedUsersResponse;
  if (resolved.skipped) {
    throw new Error(`Ops notification skipped${resolved.reason ? `: ${resolved.reason}` : ''}`);
  }

  const subscriptions = Array.isArray(resolved.subscriptions) ? resolved.subscriptions : [];
  if (subscriptions.length === 0) {
    throw new Error('Ops notification skipped: no subscriptions resolved');
  }

  const deliveryOrigin = new URL(request.url).origin;
  const deliveryResponse = await fetch(`${deliveryOrigin}${systemNotificationsPath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CRON_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url ?? '/',
      subscriptions,
    }),
  });

  if (!deliveryResponse.ok) {
    const responseText = await deliveryResponse.text();
    throw new Error(
      `System notification delivery failed (${deliveryResponse.status}): ${responseText}`,
    );
  }
}
