<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { produceItemUrl } from '@/lib/produce-hash';
  import { getSpecialtyProduceUrl } from '@/lib/specialty-produce-map';

  let {
    itemName,
    x,
    y,
    onClose,
  }: {
    itemName: string;
    x: number;
    y: number;
    onClose: () => void;
  } = $props();

  const MENU_GAP = 8;

  let copied = $state(false);
  let menuRef = $state<HTMLDivElement | null>(null);
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

  async function handleCopyLink() {
    const url = `${window.location.origin}${produceItemUrl(itemName)}`;
    await navigator.clipboard.writeText(url);
    copied = true;
    setTimeout(() => onClose(), 600);
  }

  $effect(() => {
    void positionMenu();
  });

  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef && !menuRef.contains(e.target as Node)) {
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
  });
</script>

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
  {#if specialtyUrl}
    <a
      href={specialtyUrl}
      target="_blank"
      rel="noreferrer"
      class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100"
    >
      <span>View on Specialty Produce</span>
    </a>
  {:else}
    <div class="px-4 py-2.5 text-sm text-zinc-400">No Specialty Produce link yet</div>
  {/if}

  <button
    type="button"
    onclick={() => {
      void handleCopyLink();
    }}
    class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100"
  >
    <span>{copied ? '✅' : '🔗'}</span>
    <span>{copied ? 'Copied!' : 'Copy Link'}</span>
  </button>
</div>
