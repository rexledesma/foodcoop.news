import { fetchAuthQueryFromHeaders } from '@/lib/auth';
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

    return Response.json({ url });
  } catch (error) {
    console.error('Google Wallet pass generation error:', error);
    return Response.json({ error: 'Failed to generate pass' }, { status: 500 });
  }
}
