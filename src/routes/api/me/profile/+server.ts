import {
  fetchAuthMutationFromHeaders,
  fetchAuthQueryFromHeaders,
  isUnauthenticatedError,
} from '@/lib/auth';
import { sendOpsNotification } from '@/lib/ops-notifications';
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
    const previousProfile = await fetchAuthQueryFromHeaders(
      request.headers,
      api.memberProfiles.getMemberProfile,
      {},
    );

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
    const currentUser = await fetchAuthQueryFromHeaders(
      request.headers,
      api.auth.getCurrentUser,
      {},
    );

    const actorEmail = currentUser?.email?.trim() || 'unknown-user';
    void sendOpsNotification(
      {
        title: 'foodcoop.news',
        body: `${actorEmail} saved their member profile.`,
        url: '/integrations',
      },
      request,
    ).catch((error) => {
      console.error('Failed to send profile saved notification:', error);
    });

    if (body.jobFilters !== undefined) {
      const before = previousProfile?.jobFilters ?? [];
      const after = profile?.jobFilters ?? [];
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        void sendOpsNotification(
          {
            title: 'foodcoop.news',
            body: `${actorEmail} changed selected shifts (${after.length} selected).`,
            url: '/integrations',
          },
          request,
        ).catch((error) => {
          console.error('Failed to send shift selection change notification:', error);
        });
      }
    }

    return Response.json({ profile });
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }
    console.error('Failed to update profile:', error);
    return Response.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
