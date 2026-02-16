import {
  fetchAuthMutationFromHeaders,
  fetchAuthQueryFromHeaders,
  isUnauthenticatedError,
} from '@/lib/auth';
import { api } from '../../../../../convex/_generated/api';

type ToggleFavoriteBody = {
  itemName?: string;
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

export async function POST({ request }: { request: Request }) {
  try {
    const body = (await request.json()) as ToggleFavoriteBody;
    if (!body.itemName?.trim()) {
      return Response.json({ error: 'itemName is required' }, { status: 400 });
    }

    await fetchAuthMutationFromHeaders(request.headers, api.produceFavorites.toggleFavorite, {
      itemName: body.itemName.trim(),
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
    console.error('Failed to toggle produce favorite:', error);
    return Response.json({ error: 'Failed to toggle produce favorite' }, { status: 500 });
  }
}
