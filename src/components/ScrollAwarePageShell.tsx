'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { useScrollVisibility } from '@/components/ScrollVisibilityProvider';

export function ScrollAwarePageShell({ title, children }: { title?: string; children: ReactNode }) {
  const { showSticky } = useScrollVisibility();
  const headerRef = useRef<HTMLDivElement>(null);
  const hasHeader = Boolean(title);

  useEffect(() => {
    if (!hasHeader) return;
    const element = headerRef.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return;
    }

    const updateHeight = () => {
      window.dispatchEvent(new CustomEvent('sticky-threshold', { detail: element.offsetHeight }));
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasHeader]);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-6">
      {hasHeader ? (
        <div
          ref={headerRef}
          className={`sticky top-24 z-20 bg-white transition-opacity duration-300 ease-in-out motion-reduce:transition-none md:top-14 dark:bg-zinc-900 ${
            showSticky ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <h1 className="py-6 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h1>
        </div>
      ) : null}
      <div>{children}</div>
    </div>
  );
}
