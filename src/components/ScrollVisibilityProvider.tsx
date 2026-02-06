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
  const lastScrollY = useRef(0);
  const showStickyRef = useRef(true);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    const routeIsTracked = pathname ? TRACKED_ROUTES.has(pathname) : false;

    if (!routeIsTracked || typeof window === 'undefined') {
      return;
    }

    lastScrollY.current = window.scrollY;
    showStickyRef.current = true;

    const update = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY.current;
      const absDelta = Math.abs(delta);
      const atTop = currentY <= TOP_THRESHOLD;

      if (atTop) {
        if (!showStickyRef.current) {
          showStickyRef.current = true;
          setShowSticky(true);
        }
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
    () => ({ showSticky: isTrackedRoute ? showSticky : true }),
    [isTrackedRoute, showSticky],
  );

  return (
    <ScrollVisibilityContext.Provider value={value}>{children}</ScrollVisibilityContext.Provider>
  );
}

export function useScrollVisibility() {
  const context = useContext(ScrollVisibilityContext);
  return context ?? { showSticky: true };
}
