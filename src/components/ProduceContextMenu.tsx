'use client';

import { useEffect, useRef, useState } from 'react';
import { produceItemUrl } from '@/lib/produce-hash';

interface ProduceContextMenuProps {
  itemName: string;
  x: number;
  y: number;
  onClose: () => void;
}

export function ProduceContextMenu({ itemName, x, y, onClose }: ProduceContextMenuProps) {
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleScroll = () => onClose();

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
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
      className="fixed z-50 min-w-[160px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
      style={{ left: x, top: y }}
    >
      <button
        type="button"
        onClick={handleCopyLink}
        className="w-full px-4 py-2.5 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
      >
        {copied ? 'Copied!' : 'Copy Link'}
      </button>
    </div>
  );
}
