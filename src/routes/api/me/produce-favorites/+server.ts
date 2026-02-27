import {
  fetchAuthMutationFromHeaders,
  fetchAuthQueryFromHeaders,
  isUnauthenticatedError,
} from '@/lib/auth';
import { api } from '../../../../../convex/_generated/api';

type SetFavoriteBody = {
  itemName?: string;
  favorited?: boolean;
};

function isNotAuthenticated(error: unknown): boolean {
  if (isUnauthenticatedError(error)) return true;
  return error instanceof Error && error.message.includes('Not authenticated');
}

export async function GET({ request }: { request: Request }) {
  try {
    const favorites = await fetchAuthQueryFromHeaders(
      request.headers,
      api.produceFavorites.getUserFavorites,
      {},
    );
    return Response.json({ favorites });
  } catch (error) {
    if (isNotAuthenticated(error)) {
      return Response.json({ favorites: [] }, { status: 401 });
    }
    console.error('Failed to load produce favorites:', error);
    return Response.json({ error: 'Failed to load produce favorites' }, { status: 500 });
  }
}

export async function PUT({ request }: { request: Request }) {
  try {
    const body = (await request.json()) as SetFavoriteBody;
    if (!body.itemName?.trim()) {
      return Response.json({ error: 'itemName is required' }, { status: 400 });
    }
    if (typeof body.favorited !== 'boolean') {
      return Response.json({ error: 'favorited must be a boolean' }, { status: 400 });
    }

    await fetchAuthMutationFromHeaders(request.headers, api.produceFavorites.setFavorite, {
      itemName: body.itemName.trim(),
      favorited: body.favorited,
    });

    const favorites = await fetchAuthQueryFromHeaders(
      request.headers,
      api.produceFavorites.getUserFavorites,
      {},
    );
    return Response.json({ favorites });
  } catch (error) {
    if (isNotAuthenticated(error)) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }
    console.error('Failed to set produce favorite:', error);
    return Response.json({ error: 'Failed to set produce favorite' }, { status: 500 });
  }
}
