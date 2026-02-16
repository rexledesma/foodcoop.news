import {
  fetchAuthMutationFromHeaders,
  fetchAuthQueryFromHeaders,
  isUnauthenticatedError,
} from '@/lib/auth';
import { api } from '../../../../../convex/_generated/api';

type UpdateProfileBody = {
  memberName?: string;
  memberId?: string;
  jobFilters?: string[];
};

export async function GET({ request }: { request: Request }) {
  try {
    const profile = await fetchAuthQueryFromHeaders(
      request.headers,
      api.memberProfiles.getMemberProfile,
      {},
    );

    if (!profile) {
      return Response.json({ profile: null }, { status: 401 });
    }

    return Response.json({ profile });
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return Response.json({ profile: null }, { status: 401 });
    }
    console.error('Failed to get profile:', error);
    return Response.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}

export async function POST({ request }: { request: Request }) {
  try {
    const body = (await request.json()) as UpdateProfileBody;

    await fetchAuthMutationFromHeaders(request.headers, api.memberProfiles.updateMemberProfile, {
      memberName: body.memberName,
      memberId: body.memberId,
      jobFilters: body.jobFilters,
    });

    const profile = await fetchAuthQueryFromHeaders(
      request.headers,
      api.memberProfiles.getMemberProfile,
      {},
    );

    return Response.json({ profile });
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }
    console.error('Failed to update profile:', error);
    return Response.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
