'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { usePathname } from 'next/navigation';

type ScrollVisibilityState = {
  showSticky: boolean;
};

const ScrollVisibilityContext = createContext<ScrollVisibilityState | null>(null);
const TRACKED_ROUTES = new Set(['/discover', '/produce', '/integrations']);
const REVEAL_ON_UP_STOP_ROUTES = new Set(['/discover', '/produce']);
const SCROLL_THRESHOLD = 8;
const TOP_THRESHOLD = 4;
const REVEAL_ON_UP_SCROLL_STOP_DELAY_MS = 150;

export function ScrollVisibilityProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isTrackedRoute = pathname ? TRACKED_ROUTES.has(pathname) : false;
  const [showSticky, setShowSticky] = useState(true);
  const [forceSticky, setForceSticky] = useState(false);
  const stickyThresholdRef = useRef(0);
  const lastScrollY = useRef(0);
  const showStickyRef = useRef(true);
  const isTouchInteractingRef = useRef(false);
  const lastScrollDirectionRef = useRef<'up' | 'down' | null>(null);
  const revealTimerRef = useRef<number | null>(null);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    const handleForceSticky = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      setForceSticky(Boolean(event.detail));
    };

    window.addEventListener('force-sticky', handleForceSticky as EventListener);
    return () => window.removeEventListener('force-sticky', handleForceSticky as EventListener);
  }, []);

  useEffect(() => {
    const handleHideSticky = () => {
      if (typeof window === 'undefined') return;
      if (window.scrollY <= stickyThresholdRef.current) return;
      if (!showStickyRef.current) return;
      showStickyRef.current = false;
      setShowSticky(false);
    };

    window.addEventListener('hide-sticky', handleHideSticky as EventListener);
    return () => window.removeEventListener('hide-sticky', handleHideSticky as EventListener);
  }, []);

  useEffect(() => {
    const handleStickyThreshold = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const nextThreshold = Number(event.detail);
      stickyThresholdRef.current = Number.isFinite(nextThreshold) ? Math.max(0, nextThreshold) : 0;
    };

    window.addEventListener('sticky-threshold', handleStickyThreshold as EventListener);
    return () =>
      window.removeEventListener('sticky-threshold', handleStickyThreshold as EventListener);
  }, []);

  useEffect(() => {
    const routeIsTracked = pathname ? TRACKED_ROUTES.has(pathname) : false;
    const revealOnUpStop = pathname ? REVEAL_ON_UP_STOP_ROUTES.has(pathname) : false;

    if (!routeIsTracked || typeof window === 'undefined') {
      return;
    }

    const clearRevealTimer = () => {
      if (revealTimerRef.current !== null) {
        window.clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
    };

    stickyThresholdRef.current = 0;
    lastScrollY.current = window.scrollY;
    showStickyRef.current = true;
    isTouchInteractingRef.current = false;
    lastScrollDirectionRef.current = null;
    clearRevealTimer();

    const scheduleRevealIfEligible = () => {
      clearRevealTimer();
      if (!revealOnUpStop) return;
      if (isTouchInteractingRef.current) return;
      if (lastScrollDirectionRef.current !== 'up') return;

      revealTimerRef.current = window.setTimeout(() => {
        revealTimerRef.current = null;
        if (
          !isTouchInteractingRef.current &&
          window.scrollY > stickyThresholdRef.current &&
          !showStickyRef.current
        ) {
          showStickyRef.current = true;
          setShowSticky(true);
        }
      }, REVEAL_ON_UP_SCROLL_STOP_DELAY_MS);
    };

    const update = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY.current;
      const absDelta = Math.abs(delta);
      const atTop = currentY <= TOP_THRESHOLD;

      if (currentY <= stickyThresholdRef.current) {
        clearRevealTimer();
        if (!showStickyRef.current) {
          showStickyRef.current = true;
          setShowSticky(true);
        }
        lastScrollY.current = currentY;
        return;
      }

      if (atTop) {
        clearRevealTimer();
        lastScrollY.current = currentY;
        return;
      }

      if (revealOnUpStop && absDelta > 0) {
        clearRevealTimer();
        lastScrollDirectionRef.current = delta < 0 ? 'up' : 'down';

        if (showStickyRef.current) {
          showStickyRef.current = false;
          setShowSticky(false);
        }

        if (delta < 0) scheduleRevealIfEligible();

        lastScrollY.current = currentY;
        return;
      }

      if (absDelta >= SCROLL_THRESHOLD) {
        clearRevealTimer();
        const direction = delta > 0 ? 'down' : 'up';
        const nextShowSticky = direction === 'up';
        if (nextShowSticky !== showStickyRef.current) {
          showStickyRef.current = nextShowSticky;
          setShowSticky(nextShowSticky);
        }

        lastScrollY.current = currentY;
      }
    };

    const onScroll = () => {
      if (rafId.current !== null) {
        return;
      }

      rafId.current = window.requestAnimationFrame(() => {
        rafId.current = null;
        update();
      });
    };

    rafId.current = window.requestAnimationFrame(() => {
      rafId.current = null;
      setShowSticky(true);
      update();
    });
    window.addEventListener('scroll', onScroll, { passive: true });

    const onTouchStart = () => {
      if (!revealOnUpStop) return;
      isTouchInteractingRef.current = true;
      clearRevealTimer();
    };

    const onTouchEnd = () => {
      if (!revealOnUpStop) return;
      isTouchInteractingRef.current = false;
      scheduleRevealIfEligible();
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      if (rafId.current !== null) {
        window.cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      clearRevealTimer();
    };
  }, [pathname]);

  const value = useMemo(
    () => ({ showSticky: isTrackedRoute ? showSticky || forceSticky : true }),
    [isTrackedRoute, showSticky, forceSticky],
  );

  return (
    <ScrollVisibilityContext.Provider value={value}>{children}</ScrollVisibilityContext.Provider>
  );
}

export function useScrollVisibility() {
  const context = useContext(ScrollVisibilityContext);
  return context ?? { showSticky: true };
}
