import { ConvexHttpClient } from 'convex/browser';
import { PUBLIC_CONVEX_URL } from '$env/static/public';
import { api } from '../../../../../convex/_generated/api';

const convex = new ConvexHttpClient(PUBLIC_CONVEX_URL);

type Body = {
  email: string;
};

export async function POST({ request }: { request: Request }) {
  try {
    const body = (await request.json()) as Body;
    if (!body.email) {
      return Response.json({ error: 'Missing email' }, { status: 400 });
    }

    const result = await convex.query(api.auth.checkEmailExists, { email: body.email });
    return Response.json(result);
  } catch (error) {
    console.error('Failed to check email:', error);
    return Response.json({ error: 'Failed to check email' }, { status: 500 });
  }
}
