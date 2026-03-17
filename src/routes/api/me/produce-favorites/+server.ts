import {
  fetchAuthMutationFromHeaders,
  fetchAuthQueryFromHeaders,
  isUnauthenticatedError,
} from '@/lib/auth';
import { parseJsonBody, validatedJson } from '@/lib/http-validation';
import { sendOpsNotification } from '@/lib/ops-notifications';
import { z } from 'zod';
import { api } from '../../../../../convex/_generated/api';

const setFavoriteRequestSchema = z.object({
  itemName: z.string().trim().min(1),
  favorited: z.boolean(),
});

const favoritesResponseSchema = z.object({
  favorites: z.array(z.string()),
});

function isNotAuthenticated(error: unknown): boolean {
  if (isUnauthenticatedError(error)) {
    return true;
  }
  return error instanceof Error && error.message.includes('Not authenticated');
}

export async function GET({ request }: { request: Request }) {
  try {
    const favorites = await fetchAuthQueryFromHeaders(
      request.headers,
      api.produceFavorites.getUserFavorites,
      {},
    );
    return validatedJson(favoritesResponseSchema, { favorites });
  } catch (error) {
    if (isNotAuthenticated(error)) {
      return validatedJson(favoritesResponseSchema, { favorites: [] }, { status: 401 });
    }
    console.error('Failed to load produce favorites:', error);
    return Response.json({ error: 'Failed to load produce favorites' }, { status: 500 });
  }
}

export async function PUT({ request }: { request: Request }) {
  try {
    const parsed = await parseJsonBody(request, setFavoriteRequestSchema);
    if (!parsed.success) {
      return parsed.response;
    }

    const body = parsed.data;

    await fetchAuthMutationFromHeaders(request.headers, api.produceFavorites.setFavorite, {
      itemName: body.itemName,
      favorited: body.favorited,
    });

    const currentUser = await fetchAuthQueryFromHeaders(
      request.headers,
      api.auth.getCurrentUser,
      {},
    );
    const actorEmail = currentUser?.email?.trim() || 'unknown-user';
    const actionWord = body.favorited ? 'favorited' : 'unfavorited';
    void sendOpsNotification(
      {
        title: 'foodcoop.news',
        body: `${actorEmail} ${actionWord} produce item: ${body.itemName}`,
        url: '/produce',
      },
      request,
    ).catch((error) => {
      console.error('Failed to send produce favorite activity notification:', error);
    });

    const favorites = await fetchAuthQueryFromHeaders(
      request.headers,
      api.produceFavorites.getUserFavorites,
      {},
    );
    return validatedJson(favoritesResponseSchema, { favorites });
  } catch (error) {
    if (isNotAuthenticated(error)) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }
    console.error('Failed to set produce favorite:', error);
    return Response.json({ error: 'Failed to set produce favorite' }, { status: 500 });
  }
}
