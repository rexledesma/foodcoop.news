const ALLOWED_NEXT_PATHS = new Set(['/', '/produce', '/integrations', '/about']);

function getPathname(path: string): string {
  try {
    return new URL(path, 'https://foodcoop.news').pathname;
  } catch {
    return '';
  }
}

function normalizeAuthNext(path: string | null | undefined): string | null {
  if (!path) {
    return null;
  }

  const trimmed = path.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return null;
  }

  const pathname = getPathname(trimmed);
  if (!ALLOWED_NEXT_PATHS.has(pathname)) {
    return null;
  }

  return trimmed;
}

export function withNextParam(url: string, nextPath: string | null | undefined): string {
  const next = normalizeAuthNext(nextPath);
  if (!next || getPathname(next) === '/') {
    return url;
  }

  const [base, query = ''] = url.split('?');
  const params = new URLSearchParams(query);
  params.set('next', next);
  return `${base}?${params.toString()}`;
}

export function resolveAuthDestination(
  nextPath: string | null | undefined,
  fallback = '/',
): string {
  return normalizeAuthNext(nextPath) ?? fallback;
}

export function getNextPathname(nextPath: string | null | undefined): string | null {
  const normalized = normalizeAuthNext(nextPath);
  if (!normalized) {
    return null;
  }

  return getPathname(normalized);
}
