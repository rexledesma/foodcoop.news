<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { produceItemUrl } from '@/lib/produce-hash';
  import { getSpecialtyProduceUrl } from '@/lib/specialty-produce-map';

  let {
    itemName,
    x,
    y,
    isFavorite,
    onToggleFavorite,
    onClose,
  }: {
    itemName: string;
    x: number;
    y: number;
    isFavorite: boolean;
    onToggleFavorite: (itemName: string) => void;
    onClose: () => void;
  } = $props();

  const MENU_GAP = 18;
  const DISMISS_GUARD_MS = 400;

  let copied = $state(false);
  let supportsNativeShare = $state(false);
  let menuRef = $state<HTMLDivElement | null>(null);
  let openedAt = $state(0);
  let pos = $state<{
    left: number;
    top: number;
    originX: number;
    originY: number;
  } | null>(null);

  const specialtyUrl = $derived(getSpecialtyProduceUrl(itemName));

  async function positionMenu() {
    await tick();
    const menu = menuRef;
    if (!menu) return;
    const { width, height } = menu.getBoundingClientRect();
    const pad = 8;
    let left = x - width / 2;
    let top = y - height - MENU_GAP;
    left = Math.max(pad, Math.min(left, window.innerWidth - width - pad));
    const flipped = top < pad;
    if (flipped) top = y + MENU_GAP;
    const originX = x - left;
    const originY = flipped ? 0 : height;
    pos = { left, top, originX, originY };
  }

  async function handleShareOrCopy() {
    if (isWithinDismissGuard()) return;
    const url = `${window.location.origin}${produceItemUrl(itemName)}`;
    const shareData = { title: itemName, url };

    if (supportsNativeShare && typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData);
      } catch {
        // Ignore share cancellation/errors and keep menu state unchanged.
      }
      onClose();
      return;
    }

    await navigator.clipboard.writeText(url);
    copied = true;
    setTimeout(() => onClose(), 600);
  }

  function handleSpecialtyLinkClick(event: MouseEvent) {
    if (!isWithinDismissGuard()) {
      onClose();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  }

  function isWithinDismissGuard(): boolean {
    return Date.now() - openedAt < DISMISS_GUARD_MS;
  }

  function handleBackdropPointerDown(event: PointerEvent) {
    if (isWithinDismissGuard()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    onClose();
  }

  function handleToggleFavorite() {
    if (isWithinDismissGuard()) return;
    onToggleFavorite(itemName);
    onClose();
  }

  $effect(() => {
    void positionMenu();
  });

  onMount(() => {
    openedAt = Date.now();
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      const shareData = { title: itemName, url: `${window.location.origin}${produceItemUrl(itemName)}` };
      supportsNativeShare =
        typeof navigator.canShare !== 'function' || navigator.canShare(shareData);
    } else {
      supportsNativeShare = false;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (isWithinDismissGuard()) return;
      if (menuRef && !menuRef.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleScroll = () => {
      if (isWithinDismissGuard()) return;
      onClose();
    };

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
  });
</script>

<div
  class="fixed inset-0 z-40 bg-black/25 select-none"
  onpointerdown={handleBackdropPointerDown}
  aria-hidden="true"
></div>

<div
  bind:this={menuRef}
  class={`fixed z-50 min-w-[160px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg ${
    pos ? 'context-menu-genie' : ''
  }`}
  style={
    pos
      ? `left: ${pos.left}px; top: ${pos.top}px; transform-origin: ${pos.originX}px ${pos.originY}px;`
      : `left: ${x}px; top: ${y}px; visibility: hidden;`
  }
>
  <div class="border-b border-zinc-100 px-4 py-2 text-xs font-medium text-zinc-500" title={itemName}>
    <span class="block max-w-[240px] truncate">{itemName}</span>
  </div>

  {#if specialtyUrl}
    <a
      href={specialtyUrl}
      target="_blank"
      rel="noreferrer"
      onclick={handleSpecialtyLinkClick}
      class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100"
    >
      <span class="inline-flex h-5 w-5 items-center justify-center">↗</span>
      <span>View Produce</span>
    </a>
  {:else}
    <div class="px-4 py-2.5 text-sm text-zinc-400">No Specialty Produce link yet</div>
  {/if}

  <button
    type="button"
    onclick={handleToggleFavorite}
    class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100"
  >
    <span class="inline-flex h-5 w-5 items-center justify-center">{isFavorite ? '💔' : '⭐'}</span>
    <span>{isFavorite ? 'Remove Favorite' : 'Add Favorite'}</span>
  </button>

  <button
    type="button"
    onclick={() => {
      void handleShareOrCopy();
    }}
    class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100"
  >
    <span class="inline-flex h-5 w-5 items-center justify-center"
      >{supportsNativeShare ? '📤' : copied ? '✅' : '🔗'}</span
    >
    <span>{supportsNativeShare ? 'Share' : copied ? 'Copied!' : 'Copy Link'}</span>
  </button>
</div>
