import { fetchAuthQueryFromHeaders } from '@/lib/auth';
import { sendOpsNotification } from '@/lib/ops-notifications';
import { api } from '../../../../../convex/_generated/api';
import { generateGoogleWalletURL } from '@/lib/google-wallet';

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

    const params = {
      memberId: profile.memberId,
      memberName: profile.memberName,
      serialNumber: profile.passSerialNumber,
    };
    const url = generateGoogleWalletURL(params);

    const currentUser = await fetchAuthQueryFromHeaders(
      request.headers,
      api.auth.getCurrentUser,
      {},
    );
    const actorEmail = currentUser?.email?.trim() || 'unknown-user';
    void sendOpsNotification(
      {
        title: 'foodcoop.news',
        body: `${actorEmail} generated a Google Wallet pass.`,
        url: '/integrations',
      },
      request,
    ).catch((error) => {
      console.error('Failed to send Google Wallet pass notification:', error);
    });

    return Response.json({ url });
  } catch (error) {
    console.error('Google Wallet pass generation error:', error);
    return Response.json({ error: 'Failed to generate pass' }, { status: 500 });
  }
}
