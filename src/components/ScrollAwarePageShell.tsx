'use client';

import { ReactNode, useEffect, useRef, useState, CSSProperties } from 'react';
import { useScrollVisibility } from '@/components/ScrollVisibilityProvider';

export function ScrollAwarePageShell({ title, children }: { title?: string; children: ReactNode }) {
  const { showSticky } = useScrollVisibility();
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const hasHeader = Boolean(title);

  useEffect(() => {
    const element = headerRef.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return;
    }

    const updateHeight = () => {
      setHeaderHeight(element.offsetHeight);
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="mx-auto max-w-3xl px-4 pb-6"
      style={
        hasHeader
          ? ({
              '--header-offset': `${headerHeight}px`,
            } as CSSProperties)
          : undefined
      }
    >
      {hasHeader ? (
        <div
          ref={headerRef}
          className={`sticky top-24 z-20 bg-white transition-[opacity,transform] duration-300 ease-in-out motion-reduce:transition-none md:top-14 dark:bg-zinc-900 ${
            showSticky
              ? 'translate-y-0 opacity-100'
              : 'pointer-events-none -translate-y-2 opacity-0'
          }`}
        >
          <h1 className="py-6 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h1>
        </div>
      ) : null}
      <div
        className={
          hasHeader
            ? 'transition-transform duration-300 ease-in-out motion-reduce:transition-none'
            : undefined
        }
        style={
          hasHeader
            ? {
                transform: showSticky
                  ? 'translateY(0px)'
                  : 'translateY(calc(-1 * (var(--nav-offset) + var(--header-offset))))',
              }
            : undefined
        }
      >
        {children}
      </div>
    </div>
  );
}
