import { PUBLIC_CONVEX_URL } from '$env/static/public';
import { api } from '@convex/_generated/api';
import { ConvexHttpClient } from 'convex/browser';
import { z } from 'zod';

import { parseJsonBody, validatedJson } from '@/lib/http-validation';

const convex = new ConvexHttpClient(PUBLIC_CONVEX_URL);

const favoriteCountsRequestSchema = z.object({
  itemNames: z.array(z.string()).optional(),
});

const favoriteCountsResponseSchema = z.object({
  counts: z.record(z.string(), z.number().int().nonnegative()),
});

function parseItemNames(value: string[] | undefined): string[] {
  return Array.from(new Set(value ? value.map((item) => item.trim()).filter(Boolean) : []));
}

export async function POST({ request }: { request: Request }) {
  try {
    const parsed = await parseJsonBody(request, favoriteCountsRequestSchema);
    if (!parsed.success) {
      return parsed.response;
    }

    const itemNames = parseItemNames(parsed.data.itemNames);
    const counts = await convex.query(api.produceFavorites.getFavoriteCounts, { itemNames });
    return validatedJson(favoriteCountsResponseSchema, { counts });
  } catch (error) {
    console.error('Failed to load produce favorite counts:', error);
    return Response.json({ error: 'Failed to load produce favorite counts' }, { status: 500 });
  }
}
