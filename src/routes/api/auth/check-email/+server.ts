import { PUBLIC_CONVEX_URL } from '$env/static/public';
import { api } from '@convex/_generated/api';
import { ConvexHttpClient } from 'convex/browser';
import { z } from 'zod';

import { parseJsonBody, validatedJson } from '@/lib/http-validation';

const convex = new ConvexHttpClient(PUBLIC_CONVEX_URL);

const checkEmailRequestSchema = z.object({
  email: z.string().trim().email(),
});

const checkEmailResponseSchema = z.object({
  exists: z.boolean(),
});

export async function POST({ request }: { request: Request }) {
  try {
    const parsed = await parseJsonBody(request, checkEmailRequestSchema);
    if (!parsed.success) {
      return parsed.response;
    }

    const result = await convex.query(api.auth.checkEmailExists, { email: parsed.data.email });
    return validatedJson(checkEmailResponseSchema, result);
  } catch (error) {
    console.error('Failed to check email:', error);
    return Response.json({ error: 'Failed to check email' }, { status: 500 });
  }
}
