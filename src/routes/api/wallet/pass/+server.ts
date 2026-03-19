import { fetchAuthQueryFromHeaders } from '@/lib/auth';
import { sendOpsNotification } from '@/lib/ops-notifications';
import { api } from '@convex/_generated/api';
import { generatePKPass } from '@/lib/apple-pass';

export async function GET({ request }: { request: Request }) {
  try {
    const profile = await fetchAuthQueryFromHeaders(
      request.headers,
      api.memberProfiles.getMemberProfile,
      {},
    );

    if (!profile) {
      return Response.json({ error: 'Not authenticated or profile not found' }, { status: 401 });
    }

    const passBuffer = await generatePKPass({
      memberId: profile.memberId,
      memberName: profile.memberName,
      serialNumber: profile.passSerialNumber,
    });

    const currentUser = await fetchAuthQueryFromHeaders(
      request.headers,
      api.auth.getCurrentUser,
      {},
    );
    const actorEmail = currentUser?.email?.trim() || 'unknown-user';
    void sendOpsNotification(
      {
        title: 'foodcoop.news',
        body: `${actorEmail} generated an Apple Wallet pass.`,
        url: '/integrations',
      },
      request,
    ).catch((error) => {
      console.error('Failed to send Apple Wallet pass notification:', error);
    });

    return new Response(new Uint8Array(passBuffer), {
      headers: {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Content-Disposition': 'inline; filename="psfc-member-card.pkpass"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Wallet pass generation error:', error);
    return Response.json({ error: 'Failed to generate pass' }, { status: 500 });
  }
}
