import {
  fetchAuthMutationFromHeaders,
  fetchAuthQueryFromHeaders,
  isUnauthenticatedError,
} from '@/lib/auth';
import { parseJsonBody, validatedJson } from '@/lib/http-validation';
import { sendOpsNotification } from '@/lib/ops-notifications';
import { z } from 'zod';
import { api } from '@convex/_generated/api';

const updateProfileRequestSchema = z.object({
  memberName: z.string().trim().optional(),
  memberId: z.string().trim().optional(),
  jobFilters: z.array(z.string()).optional(),
});

const memberProfileSchema = z.object({
  _id: z.string(),
  _creationTime: z.number(),
  userId: z.string(),
  memberId: z.string(),
  memberName: z.string(),
  passSerialNumber: z.string(),
  calendarId: z.string(),
  jobFilters: z.array(z.string()),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const profileResponseSchema = z.object({
  profile: memberProfileSchema.nullable(),
});

export async function GET({ request }: { request: Request }) {
  try {
    const profile = await fetchAuthQueryFromHeaders(
      request.headers,
      api.memberProfiles.getMemberProfile,
      {},
    );

    if (!profile) {
      return validatedJson(profileResponseSchema, { profile: null }, { status: 401 });
    }

    return validatedJson(profileResponseSchema, { profile });
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return validatedJson(profileResponseSchema, { profile: null }, { status: 401 });
    }
    console.error('Failed to get profile:', error);
    return Response.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}

export async function POST({ request }: { request: Request }) {
  try {
    const parsed = await parseJsonBody(request, updateProfileRequestSchema);
    if (!parsed.success) {
      return parsed.response;
    }

    const body = parsed.data;
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

    return validatedJson(profileResponseSchema, { profile });
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }
    console.error('Failed to update profile:', error);
    return Response.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
