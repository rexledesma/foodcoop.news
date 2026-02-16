import {
  fetchAuthMutationFromHeaders,
  fetchAuthQueryFromHeaders,
  isUnauthenticatedError,
} from '@/lib/auth';
import { api } from '../../../../../convex/_generated/api';

type SaveBody = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

type DeleteBody = {
  endpoint: string;
};

export async function GET({ request }: { request: Request }) {
  try {
    const subscriptions = await fetchAuthQueryFromHeaders(
      request.headers,
      api.pushSubscriptions.getUserPushSubscriptions,
      {},
    );

    return Response.json({ subscriptions });
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return Response.json({ subscriptions: [] }, { status: 401 });
    }
    console.error('Failed to load push subscriptions:', error);
    return Response.json({ error: 'Failed to load push subscriptions' }, { status: 500 });
  }
}

export async function POST({ request }: { request: Request }) {
  try {
    const body = (await request.json()) as SaveBody;
    await fetchAuthMutationFromHeaders(
      request.headers,
      api.pushSubscriptions.savePushSubscription,
      {
        endpoint: body.endpoint,
        p256dh: body.p256dh,
        auth: body.auth,
      },
    );
    return Response.json({ success: true });
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }
    console.error('Failed to save push subscription:', error);
    return Response.json({ error: 'Failed to save push subscription' }, { status: 500 });
  }
}

export async function DELETE({ request }: { request: Request }) {
  try {
    const body = (await request.json()) as DeleteBody;
    await fetchAuthMutationFromHeaders(
      request.headers,
      api.pushSubscriptions.deletePushSubscription,
      { endpoint: body.endpoint },
    );
    return Response.json({ success: true });
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }
    console.error('Failed to delete push subscription:', error);
    return Response.json({ error: 'Failed to delete push subscription' }, { status: 500 });
  }
}
