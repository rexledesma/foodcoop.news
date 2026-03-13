import { ConvexHttpClient } from 'convex/browser';
import { PUBLIC_CONVEX_URL } from '$env/static/public';
import { api } from '../../../../../convex/_generated/api';

const convex = new ConvexHttpClient(PUBLIC_CONVEX_URL);

type Body = {
  itemNames?: unknown;
};

function parseItemNames(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export async function POST({ request }: { request: Request }) {
  try {
    const body = (await request.json()) as Body;
    const itemNames = parseItemNames(body.itemNames);
    const counts = await convex.query(api.produceFavorites.getFavoriteCounts, { itemNames });
    return Response.json({ counts });
  } catch (error) {
    console.error('Failed to load produce favorite counts:', error);
    return Response.json({ error: 'Failed to load produce favorite counts' }, { status: 500 });
  }
}
