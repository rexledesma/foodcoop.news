const TRACKED_ROUTES = new Set(['/discover', '/produce', '/integrations']);
const REVEAL_ON_UP_STOP_ROUTES = new Set(['/discover', '/produce']);
const SCROLL_THRESHOLD = 8;
const TOP_THRESHOLD = 4;
const REVEAL_ON_UP_SCROLL_STOP_DELAY_MS = 250;
const REVEAL_ON_UP_MIN_REVERSE_SCROLL_PX = 144;

let initialized = false;
let isTrackedRoute = false;
let revealOnUpStop = false;
let showSticky = true;
let forceSticky = false;
let stickyThreshold = 0;
let lastScrollY = 0;
let isTouchInteracting = false;
let lastScrollDirection: 'up' | 'down' | null = null;
let reverseScrollDistance = 0;
let revealTimer: number | null = null;
let rafId: number | null = null;

function clearRevealTimer() {
  if (revealTimer !== null) {
    window.clearTimeout(revealTimer);
    revealTimer = null;
  }
}

function computedVisibility(): boolean {
  return isTrackedRoute ? showSticky || forceSticky : true;
}

function emitVisibility() {
  window.dispatchEvent(new CustomEvent('sticky-visibility', { detail: computedVisibility() }));
}

function scheduleRevealIfEligible() {
  clearRevealTimer();
  if (!revealOnUpStop) return;
  if (isTouchInteracting) return;
  if (lastScrollDirection !== 'up') return;
  if (reverseScrollDistance < REVEAL_ON_UP_MIN_REVERSE_SCROLL_PX) return;

  revealTimer = window.setTimeout(() => {
    revealTimer = null;
    if (!isTouchInteracting && window.scrollY > stickyThreshold && !showSticky) {
      showSticky = true;
      emitVisibility();
    }
  }, REVEAL_ON_UP_SCROLL_STOP_DELAY_MS);
}

function updateFromScroll() {
  const currentY = window.scrollY;
  const delta = currentY - lastScrollY;
  const absDelta = Math.abs(delta);
  const atTop = currentY <= TOP_THRESHOLD;

  if (currentY <= stickyThreshold) {
    clearRevealTimer();
    reverseScrollDistance = 0;
    if (!showSticky) {
      showSticky = true;
      emitVisibility();
    }
    lastScrollY = currentY;
    return;
  }

  if (atTop) {
    clearRevealTimer();
    reverseScrollDistance = 0;
    lastScrollY = currentY;
    return;
  }

  if (revealOnUpStop && absDelta > 0) {
    clearRevealTimer();
    lastScrollDirection = delta < 0 ? 'up' : 'down';

    if (delta < 0) {
      reverseScrollDistance += absDelta;
    } else {
      reverseScrollDistance = 0;
    }

    if (showSticky) {
      showSticky = false;
      emitVisibility();
    }

    if (delta < 0) {
      scheduleRevealIfEligible();
    }

    lastScrollY = currentY;
    return;
  }

  if (absDelta >= SCROLL_THRESHOLD) {
    clearRevealTimer();
    const direction = delta > 0 ? 'down' : 'up';
    const nextShowSticky = direction === 'up';
    if (nextShowSticky !== showSticky) {
      showSticky = nextShowSticky;
      emitVisibility();
    }
    lastScrollY = currentY;
  }
}

function resetRouteState() {
  stickyThreshold = 0;
  lastScrollY = window.scrollY;
  showSticky = true;
  isTouchInteracting = false;
  lastScrollDirection = null;
  reverseScrollDistance = 0;
  clearRevealTimer();
}

function bindGlobalListeners() {
  window.addEventListener('force-sticky', (event) => {
    if (!(event instanceof CustomEvent)) return;
    forceSticky = Boolean(event.detail);
    emitVisibility();
  });

  window.addEventListener('hide-sticky', () => {
    if (window.scrollY <= stickyThreshold) return;
    if (!showSticky) return;
    showSticky = false;
    emitVisibility();
  });

  window.addEventListener('sticky-threshold', (event) => {
    if (!(event instanceof CustomEvent)) return;
    const nextThreshold = Number(event.detail);
    stickyThreshold = Number.isFinite(nextThreshold) ? Math.max(0, nextThreshold) : 0;
  });

  window.addEventListener(
    'scroll',
    () => {
      if (!isTrackedRoute) return;
      if (rafId !== null) return;

      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        updateFromScroll();
      });
    },
    { passive: true },
  );

  window.addEventListener(
    'touchstart',
    () => {
      if (!revealOnUpStop) return;
      isTouchInteracting = true;
      clearRevealTimer();
    },
    { passive: true },
  );

  const onTouchEnd = () => {
    if (!revealOnUpStop) return;
    isTouchInteracting = false;
    scheduleRevealIfEligible();
  };

  window.addEventListener('touchend', onTouchEnd, { passive: true });
  window.addEventListener('touchcancel', onTouchEnd, { passive: true });
}

export function initStickyVisibility(pathname: string) {
  if (typeof window === 'undefined') return;
  if (!initialized) {
    bindGlobalListeners();
    initialized = true;
  }
  setStickyVisibilityRoute(pathname);
}

export function setStickyVisibilityRoute(pathname: string) {
  if (typeof window === 'undefined') return;

  isTrackedRoute = TRACKED_ROUTES.has(pathname);
  revealOnUpStop = REVEAL_ON_UP_STOP_ROUTES.has(pathname);

  resetRouteState();

  if (rafId !== null) {
    window.cancelAnimationFrame(rafId);
    rafId = null;
  }

  rafId = window.requestAnimationFrame(() => {
    rafId = null;
    showSticky = true;
    emitVisibility();
    if (isTrackedRoute) {
      updateFromScroll();
    }
  });
}

export function getCurrentStickyVisibility() {
  if (typeof window === 'undefined') return true;
  return computedVisibility();
}
