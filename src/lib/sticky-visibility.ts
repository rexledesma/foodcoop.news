const TRACKED_ROUTES = new Set(['/', '/produce', '/integrations']);
const SCROLL_THRESHOLD = 8;
const TOP_THRESHOLD = 4;

let initialized = false;
let isTrackedRoute = false;
let showSticky = true;
let forceSticky = false;
let stickyThreshold = 0;
let lastScrollY = 0;
let rafId: number | null = null;

function computedVisibility(): boolean {
  return isTrackedRoute ? showSticky || forceSticky : true;
}

function emitVisibility(): void {
  window.dispatchEvent(new CustomEvent('sticky-visibility', { detail: computedVisibility() }));
}

function updateFromScroll(): void {
  const currentY = window.scrollY;
  const delta = currentY - lastScrollY;
  const absDelta = Math.abs(delta);
  const atTop = currentY <= TOP_THRESHOLD;

  if (currentY <= stickyThreshold) {
    if (!showSticky) {
      showSticky = true;
      emitVisibility();
    }
    lastScrollY = currentY;
    return;
  }

  if (atTop) {
    lastScrollY = currentY;
    return;
  }

  if (absDelta >= SCROLL_THRESHOLD) {
    const direction = delta > 0 ? 'down' : 'up';
    const nextShowSticky = direction === 'up';
    if (nextShowSticky !== showSticky) {
      showSticky = nextShowSticky;
      emitVisibility();
    }
    lastScrollY = currentY;
  }
}

function resetRouteState(): void {
  stickyThreshold = 0;
  lastScrollY = window.scrollY;
  showSticky = true;
}

function bindGlobalListeners(): void {
  window.addEventListener('force-sticky', (event): void => {
    if (!(event instanceof CustomEvent)) {
      return;
    }
    forceSticky = Boolean(event.detail);
    emitVisibility();
  });

  window.addEventListener('hide-sticky', (): void => {
    if (window.scrollY <= stickyThreshold) {
      return;
    }
    if (!showSticky) {
      return;
    }
    showSticky = false;
    emitVisibility();
  });

  window.addEventListener('sticky-threshold', (event): void => {
    if (!(event instanceof CustomEvent)) {
      return;
    }
    const nextThreshold = Number(event.detail);
    stickyThreshold = Number.isFinite(nextThreshold) ? Math.max(0, nextThreshold) : 0;
  });

  window.addEventListener(
    'scroll',
    (): void => {
      if (!isTrackedRoute) {
        return;
      }
      if (rafId !== null) {
        return;
      }

      rafId = window.requestAnimationFrame((): void => {
        rafId = null;
        updateFromScroll();
      });
    },
    { passive: true },
  );
}

export function initStickyVisibility(pathname: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (!initialized) {
    bindGlobalListeners();
    initialized = true;
  }
  setStickyVisibilityRoute(pathname);
}

export function setStickyVisibilityRoute(pathname: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  isTrackedRoute = TRACKED_ROUTES.has(pathname);

  resetRouteState();

  if (rafId !== null) {
    window.cancelAnimationFrame(rafId);
    rafId = null;
  }

  rafId = window.requestAnimationFrame((): void => {
    rafId = null;
    showSticky = true;
    emitVisibility();
    if (isTrackedRoute) {
      updateFromScroll();
    }
  });
}

export function getCurrentStickyVisibility(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }
  return computedVisibility();
}
