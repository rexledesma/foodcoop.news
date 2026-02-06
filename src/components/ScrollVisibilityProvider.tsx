'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { usePathname } from 'next/navigation';

type ScrollVisibilityState = {
  showSticky: boolean;
};

const ScrollVisibilityContext = createContext<ScrollVisibilityState | null>(null);
const TRACKED_ROUTES = new Set(['/discover', '/produce', '/integrations']);
const SCROLL_THRESHOLD = 8;
const TOP_THRESHOLD = 4;

export function ScrollVisibilityProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isTrackedRoute = pathname ? TRACKED_ROUTES.has(pathname) : false;
  const [showSticky, setShowSticky] = useState(true);
  const [forceSticky, setForceSticky] = useState(false);
  const stickyThresholdRef = useRef(0);
  const lastScrollY = useRef(0);
  const showStickyRef = useRef(true);
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

    if (!routeIsTracked || typeof window === 'undefined') {
      return;
    }

    stickyThresholdRef.current = 0;
    lastScrollY.current = window.scrollY;
    showStickyRef.current = true;

    const update = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY.current;
      const absDelta = Math.abs(delta);
      const atTop = currentY <= TOP_THRESHOLD;

      if (currentY <= stickyThresholdRef.current) {
        if (!showStickyRef.current) {
          showStickyRef.current = true;
          setShowSticky(true);
        }
        lastScrollY.current = currentY;
        return;
      }

      if (atTop) {
        lastScrollY.current = currentY;
        return;
      }

      if (absDelta >= SCROLL_THRESHOLD) {
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
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId.current !== null) {
        window.cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
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
