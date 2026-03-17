import {
  fetchAuthMutationFromHeaders,
  fetchAuthQueryFromHeaders,
  isUnauthenticatedError,
} from '@/lib/auth';
import { parseJsonBody, validatedJson } from '@/lib/http-validation';
import { z } from 'zod';
import { api } from '../../../../../convex/_generated/api';

const saveSubscriptionRequestSchema = z.object({
  endpoint: z.string().min(1),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
});

const deleteSubscriptionRequestSchema = z.object({
  endpoint: z.string().min(1),
});

const subscriptionsResponseSchema = z.object({
  subscriptions: z.array(
    z.object({
      endpoint: z.string(),
      createdAt: z.number(),
    }),
  ),
});

const successResponseSchema = z.object({
  success: z.literal(true),
});

export async function GET({ request }: { request: Request }) {
  try {
    const subscriptions = await fetchAuthQueryFromHeaders(
      request.headers,
      api.pushSubscriptions.getUserPushSubscriptions,
      {},
    );

    return validatedJson(subscriptionsResponseSchema, { subscriptions });
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return validatedJson(subscriptionsResponseSchema, { subscriptions: [] }, { status: 401 });
    }
    console.error('Failed to load push subscriptions:', error);
    return Response.json({ error: 'Failed to load push subscriptions' }, { status: 500 });
  }
}

export async function POST({ request }: { request: Request }) {
  try {
    const parsed = await parseJsonBody(request, saveSubscriptionRequestSchema);
    if (!parsed.success) {
      return parsed.response;
    }

    const body = parsed.data;
    await fetchAuthMutationFromHeaders(
      request.headers,
      api.pushSubscriptions.savePushSubscription,
      {
        endpoint: body.endpoint,
        p256dh: body.p256dh,
        auth: body.auth,
      },
    );
    return validatedJson(successResponseSchema, { success: true });
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
    const parsed = await parseJsonBody(request, deleteSubscriptionRequestSchema);
    if (!parsed.success) {
      return parsed.response;
    }

    const body = parsed.data;
    await fetchAuthMutationFromHeaders(
      request.headers,
      api.pushSubscriptions.deletePushSubscription,
      { endpoint: body.endpoint },
    );
    return validatedJson(successResponseSchema, { success: true });
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }
    console.error('Failed to delete push subscription:', error);
    return Response.json({ error: 'Failed to delete push subscription' }, { status: 500 });
  }
}
