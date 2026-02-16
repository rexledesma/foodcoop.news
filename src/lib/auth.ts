import { getToken, type GetTokenOptions } from '@convex-dev/better-auth/utils';
import { ConvexHttpClient } from 'convex/browser';
import type { FunctionReference, FunctionReturnType, OptionalRestArgs } from 'convex/server';

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;
const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL!;

const authOptions: GetTokenOptions = {
  jwtCache: {
    enabled: true,
    isAuthError: () => false,
  },
};

const parseConvexSiteUrl = (url: string) => {
  if (!url) {
    throw new Error('NEXT_PUBLIC_CONVEX_SITE_URL is not set');
  }
  if (url.endsWith('.convex.cloud')) {
    throw new Error(
      `NEXT_PUBLIC_CONVEX_SITE_URL must end in .convex.site. Currently set to ${url}`,
    );
  }
  return url;
};

const siteUrl = parseConvexSiteUrl(convexSiteUrl);

function setupClient(token?: string) {
  const client = new ConvexHttpClient(convexUrl);
  if (token !== undefined) {
    client.setAuth(token);
  }
  // @ts-expect-error Internal helper available on ConvexHttpClient.
  client.setFetchOptions({ cache: 'no-store' });
  return client;
}

async function callWithToken<FnResult>(
  headers: Headers,
  fn: (token?: string) => Promise<FnResult>,
): Promise<FnResult> {
  const token = await getToken(siteUrl, headers, authOptions);
  try {
    return await fn(token.token);
  } catch (error) {
    if (
      !authOptions.jwtCache?.enabled ||
      token.isFresh ||
      authOptions.jwtCache.isAuthError(error)
    ) {
      throw error;
    }
    const refreshed = await getToken(siteUrl, headers, { ...authOptions, forceRefresh: true });
    return await fn(refreshed.token);
  }
}

export async function fetchAuthQueryFromHeaders<Query extends FunctionReference<'query'>>(
  headers: Headers,
  query: Query,
  ...args: OptionalRestArgs<Query>
): Promise<FunctionReturnType<Query>> {
  return callWithToken(headers, (token?: string) => {
    const client = setupClient(token);
    return client.query(query, ...args);
  });
}

export async function fetchAuthMutationFromHeaders<Mutation extends FunctionReference<'mutation'>>(
  headers: Headers,
  mutation: Mutation,
  ...args: OptionalRestArgs<Mutation>
): Promise<FunctionReturnType<Mutation>> {
  return callWithToken(headers, (token?: string) => {
    const client = setupClient(token);
    return client.mutation(mutation, ...args);
  });
}

export function isUnauthenticatedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const maybe = error as {
    message?: unknown;
    data?: unknown;
  };

  if (maybe.data === 'Unauthenticated') return true;
  if (typeof maybe.message === 'string' && maybe.message.includes('Unauthenticated')) return true;

  return false;
}
