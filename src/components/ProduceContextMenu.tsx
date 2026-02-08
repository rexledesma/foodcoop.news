'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { produceItemUrl } from '@/lib/produce-hash';

interface ProduceContextMenuProps {
  itemName: string;
  x: number;
  y: number;
  onClose: () => void;
}

const MENU_GAP = 8;

export function ProduceContextMenu({ itemName, x, y, onClose }: ProduceContextMenuProps) {
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{
    left: number;
    top: number;
    originX: number;
    originY: number;
  } | null>(null);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const { width, height } = menu.getBoundingClientRect();
    const pad = 8;
    let left = x - width / 2;
    let top = y - height - MENU_GAP;
    // Clamp to viewport
    left = Math.max(pad, Math.min(left, window.innerWidth - width - pad));
    const flipped = top < pad;
    if (flipped) top = y + MENU_GAP;
    // Transform origin at the touch point relative to the menu
    const originX = x - left;
    const originY = flipped ? 0 : height;
    setPos({ left, top, originX, originY });
  }, [x, y]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleScroll = () => onClose();

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  const handleCopyLink = async () => {
    const url = `${window.location.origin}${produceItemUrl(itemName)}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => onClose(), 600);
  };

  return (
    <div
      ref={menuRef}
      className={`fixed z-50 min-w-[160px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800 ${pos ? 'context-menu-genie' : ''}`}
      style={
        pos
          ? {
              left: pos.left,
              top: pos.top,
              transformOrigin: `${pos.originX}px ${pos.originY}px`,
            }
          : { left: x, top: y, visibility: 'hidden' as const }
      }
    >
      <button
        type="button"
        onClick={handleCopyLink}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
      >
        <span>{copied ? '✅' : '🔗'}</span>
        <span>{copied ? 'Copied!' : 'Copy Link'}</span>
      </button>
    </div>
  );
}
