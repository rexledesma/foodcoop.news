<script lang="ts">
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';

  type NavigationClientState = {
    pathname: string;
    loginHref: string;
    showSticky: boolean;
    isPending: boolean;
    isAuthenticated: boolean;
    memberName: string;
    memberId: string;
    userEmail: string;
    swipeFromPath: string | null;
    swipeToPath: string | null;
    swipeProgress: number;
    isSwipeActive: boolean;
    onSignOut: () => Promise<void>;
  };

  type NavIconName = 'news' | 'produce' | 'carrot' | 'gear' | 'info';

  const navItems: { href: string; label: string; icon: NavIconName }[] = [
    { href: '/', label: 'News', icon: 'news' },
    { href: '/produce', label: 'Produce', icon: 'produce' },
    { href: '/integrations', label: 'Integrations', icon: 'gear' },
  ];

  const aboutItem: { href: string; label: string; icon: NavIconName } = {
    href: '/about',
    label: 'About',
    icon: 'info',
  };

  let {
    channel,
    initialState,
  }: {
    channel: string;
    initialState: NavigationClientState;
  } = $props();

  let pathname = $state('');
  let loginHref = $state('/login');
  let showSticky = $state(true);
  let isPending = $state(true);
  let isAuthenticated = $state(false);
  let memberName = $state('');
  let memberId = $state('');
  let userEmail = $state('');
  let swipeFromPath = $state<string | null>(null);
  let swipeToPath = $state<string | null>(null);
  let swipeProgress = $state(0);
  let isSwipeActive = $state(false);

  let onSignOut = $state<() => Promise<void>>(async () => {});

  let mobileScrollRef = $state<HTMLDivElement | null>(null);
  let activeIndicatorLeft = $state(0);
  let activeIndicatorTop = $state(0);
  let activeIndicatorWidth = $state(0);
  let showActiveIndicator = $state(false);
  let shouldReplaceHistoryOnMobile = $state(false);
  let isSidebarOpen = $state(false);
  let produceFavoritesCount = $state(0);
  let produceFavoritesInStockCount = $state(0);
  let produceFavoritesOutOfStockCount = $state(0);
  let showSidebarInstallAppButton = $state(false);

  function closeSidebar() {
    isSidebarOpen = false;
  }

  function toggleSidebar() {
    isSidebarOpen = !isSidebarOpen;
    if (isSidebarOpen) {
      window.dispatchEvent(new CustomEvent('navigation:sidebar-opened'));
    }
  }

  function isStandaloneMode(): boolean {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  }

  function isMobileInstallCapableDevice(): boolean {
    const userAgent = navigator.userAgent || '';
    const isAppleMobile =
      /iPhone|iPad|iPod/i.test(userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroidMobile = /Android/i.test(userAgent);

    return (isAppleMobile || isAndroidMobile) && 'serviceWorker' in navigator;
  }

  function updateSidebarInstallAppButtonVisibility() {
    showSidebarInstallAppButton = !isStandaloneMode() && isMobileInstallCapableDevice();
  }

  function openInstallPromptFromSidebar() {
    window.dispatchEvent(new CustomEvent('pwa-install:show', { detail: { force: true, expandHowTo: true } }));
  }

  async function hydrateProduceFavoritesSummary() {
    if (typeof window === 'undefined') return;
    try {
      const response = await fetch('/api/me/produce-favorites/summary', {
        headers: { accept: 'application/json' },
      });
      if (!response.ok) return;

      const payload = (await response.json()) as {
        favoritesCount?: unknown;
        inStockCount?: unknown;
        outOfStockCount?: unknown;
      };

      if (typeof payload.favoritesCount === 'number') {
        produceFavoritesCount = payload.favoritesCount;
      }
      if (typeof payload.inStockCount === 'number') {
        produceFavoritesInStockCount = payload.inStockCount;
      }
      if (typeof payload.outOfStockCount === 'number') {
        produceFavoritesOutOfStockCount = payload.outOfStockCount;
      }
    } catch {
      // Ignore failures and keep current values.
    }
  }

  function getSignupHref(): string {
    const queryString = loginHref.split('?')[1] ?? '';
    const next = new URLSearchParams(queryString).get('next');
    if (!next) return '/signup';
    return `/signup?next=${encodeURIComponent(next)}`;
  }

  function getNavIcon(icon: NavIconName): string {
    switch (icon) {
      case 'news':
        return '🗞️';
      case 'produce':
        return '🥬';
      case 'carrot':
        return '🥕';
      case 'gear':
        return '⚙️';
      case 'info':
        return 'ℹ️';
      default:
        return '';
    }
  }

  function applyState(next: NavigationClientState) {
    pathname = next.pathname;
    loginHref = next.loginHref;
    showSticky = next.showSticky;
    isPending = next.isPending;
    isAuthenticated = next.isAuthenticated;
    memberName = next.memberName;
    memberId = next.memberId;
    userEmail = next.userEmail;
    swipeFromPath = next.swipeFromPath;
    swipeToPath = next.swipeToPath;
    swipeProgress = next.swipeProgress;
    isSwipeActive = next.isSwipeActive;
    onSignOut = next.onSignOut;
  }

  function handleStateUpdate(event: Event) {
    if (!(event instanceof CustomEvent)) return;
    applyState(event.detail as NavigationClientState);
  }

  function isVisible(node: Element): node is HTMLElement {
    return node instanceof HTMLElement && node.getClientRects().length > 0;
  }

  function normalizePathname(path: string | null): string {
    if (!path) return '';
    if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
    return path;
  }

  function getNavLabelRect(path: string | null): DOMRect | null {
    const container = mobileScrollRef;
    const normalized = normalizePathname(path);
    if (!container || !normalized) return null;

    const routeItems = Array.from(container.querySelectorAll('[data-nav-href]'));
    const routeItem = routeItems.find(
      (node) => node.getAttribute('data-nav-href') === normalized && isVisible(node),
    );
    if (!routeItem) return null;

    const label = routeItem.querySelector('[data-nav-label]');
    if (!label || !isVisible(label)) return null;
    return label.getBoundingClientRect();
  }

  function centerCurrentRouteInMobileNav() {
    const container = mobileScrollRef;
    if (!container) return;

    const routeItems = Array.from(container.querySelectorAll('[data-nav-href]'));
    const activeItem = routeItems.find(
      (node) => node.getAttribute('data-nav-href') === pathname && isVisible(node),
    );
    if (!activeItem) return;

    const containerRect = container.getBoundingClientRect();
    const itemRect = activeItem.getBoundingClientRect();
    const nextLeft =
      container.scrollLeft +
      (itemRect.left - containerRect.left) -
      (container.clientWidth / 2 - itemRect.width / 2);

    const maxLeft = Math.max(0, container.scrollWidth - container.clientWidth);
    const clampedLeft = Math.min(maxLeft, Math.max(0, nextLeft));
    container.scrollTo({ left: clampedLeft, behavior: 'smooth' });
  }

  function centeredScrollLeft(itemLeft: number, itemWidth: number, container: HTMLElement): number {
    const nextLeft = itemLeft - (container.clientWidth / 2 - itemWidth / 2);
    const maxLeft = Math.max(0, container.scrollWidth - container.clientWidth);
    return Math.min(maxLeft, Math.max(0, nextLeft));
  }

  function updateActiveRouteIndicator() {
    const container = mobileScrollRef;
    if (!container || !pathname) {
      showActiveIndicator = false;
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const fromRect = getNavLabelRect(isSwipeActive ? swipeFromPath : pathname);
    if (!fromRect) {
      showActiveIndicator = false;
      return;
    }
    const toRect = isSwipeActive ? getNavLabelRect(swipeToPath) : null;
    const progress = Math.min(1, Math.max(0, swipeProgress));

    const fromLeft = fromRect.left - containerRect.left + container.scrollLeft;
    const toLeft = toRect ? toRect.left - containerRect.left + container.scrollLeft : fromLeft;
    const fromWidth = fromRect.width;
    const toWidth = toRect ? toRect.width : fromWidth;
    const fromTop = Math.max(0, container.clientHeight - 2);
    const toTop = fromTop;

    activeIndicatorLeft = fromLeft + (toLeft - fromLeft) * progress;
    activeIndicatorTop = fromTop + (toTop - fromTop) * progress;
    activeIndicatorWidth = fromWidth + (toWidth - fromWidth) * progress;

    if (isSwipeActive && toRect) {
      const fromScrollLeft = centeredScrollLeft(fromLeft, fromWidth, container);
      const toScrollLeft = centeredScrollLeft(toLeft, toWidth, container);
      container.scrollLeft = fromScrollLeft + (toScrollLeft - fromScrollLeft) * progress;
    }

    showActiveIndicator = true;
  }

  onMount(() => {
    const coarsePointerMedia = window.matchMedia('(pointer: coarse)');
    const updateHistoryReplaceMode = () => {
      shouldReplaceHistoryOnMobile = coarsePointerMedia.matches || navigator.maxTouchPoints > 0;
    };
    updateHistoryReplaceMode();
    coarsePointerMedia.addEventListener('change', updateHistoryReplaceMode);

    applyState(initialState);

    const handler = (event: Event) => handleStateUpdate(event);
    const syncFavorites = () => {
      if (!isAuthenticated) return;
      void hydrateProduceFavoritesSummary();
    };
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSidebar();
      }
    };
    const displayModeMedia = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = () => {
      updateSidebarInstallAppButtonVisibility();
    };
    window.addEventListener(`navigation-state:update:${channel}`, handler as EventListener);
    window.addEventListener('produce-favorites', syncFavorites);
    window.addEventListener('produce-favorites-cache', syncFavorites);
    window.addEventListener('keydown', handleEscapeKey);
    window.addEventListener('focus', handleDisplayModeChange);
    displayModeMedia.addEventListener('change', handleDisplayModeChange);
    updateSidebarInstallAppButtonVisibility();
    void hydrateProduceFavoritesSummary();

    const container = mobileScrollRef;
    const handleScroll = () => updateActiveRouteIndicator();
    const handleResize = () => updateActiveRouteIndicator();
    container?.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    requestAnimationFrame(updateActiveRouteIndicator);

    return () => {
      coarsePointerMedia.removeEventListener('change', updateHistoryReplaceMode);
      window.removeEventListener(`navigation-state:update:${channel}`, handler as EventListener);
      window.removeEventListener('produce-favorites', syncFavorites);
      window.removeEventListener('produce-favorites-cache', syncFavorites);
      window.removeEventListener('keydown', handleEscapeKey);
      window.removeEventListener('focus', handleDisplayModeChange);
      displayModeMedia.removeEventListener('change', handleDisplayModeChange);
      container?.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  });

  $effect(() => {
    if (!pathname) return;
    requestAnimationFrame(() => {
      centerCurrentRouteInMobileNav();
      requestAnimationFrame(updateActiveRouteIndicator);
    });
  });

  $effect(() => {
    const swipeSignature = `${swipeFromPath ?? ''}|${swipeToPath ?? ''}|${swipeProgress}|${
      isSwipeActive ? 1 : 0
    }`;
    if (!swipeSignature) return;
    requestAnimationFrame(updateActiveRouteIndicator);
  });

  $effect(() => {
    if (!pathname) return;
    closeSidebar();
  });

  $effect(() => {
    if (typeof document === 'undefined') return;
    if (!isSidebarOpen) return;

    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyOverscroll = document.body.style.overscrollBehavior;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';

    return () => {
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.overscrollBehavior = originalBodyOverscroll;
    };
  });

  $effect(() => {
    if (typeof window === 'undefined') return;
    if (!isAuthenticated) {
      produceFavoritesCount = 0;
      produceFavoritesInStockCount = 0;
      produceFavoritesOutOfStockCount = 0;
      return;
    }
    void hydrateProduceFavoritesSummary();
  });
</script>

<nav
  data-swipe-interactive="true"
  class={`safe-area-pt fixed top-0 right-0 left-0 z-40 bg-gradient-to-b from-[#e6f3fc] via-[#e6f9f0] to-white transition-opacity duration-300 ease-in-out motion-reduce:transition-none ${
    showSticky ? 'opacity-100' : 'pointer-events-none opacity-0'
  }`}
>
  <div class="mx-auto grid h-12 max-w-3xl grid-cols-[2.5rem_1fr_2.5rem] items-center px-4">
    <button
      type="button"
      onclick={toggleSidebar}
      class="flex h-6 w-6 select-none items-center justify-center rounded-md text-zinc-700 transition-colors hover:bg-zinc-200/60 hover:text-black"
      aria-label={isSidebarOpen ? 'Close menu' : 'Open menu'}
      aria-expanded={isSidebarOpen}
      aria-controls="navigation-sidebar"
    >
      <span class="sr-only">{isSidebarOpen ? 'Close menu' : 'Open menu'}</span>
      <span class="inline-flex h-4 w-5 flex-col justify-between" aria-hidden="true">
        <span class="h-0.5 w-full rounded-full bg-current"></span>
        <span class="h-0.5 w-full rounded-full bg-current"></span>
        <span class="h-0.5 w-full rounded-full bg-current"></span>
      </span>
    </button>
    <a
      href="/"
      class="select-none text-center text-base leading-none font-bold text-zinc-700"
      style="font-family: 'DIN 1451 Std Engschrift', 'DIN 1451 Engschrift', Bahnschrift, 'DIN Alternate', 'Franklin Gothic Medium', sans-serif;"
    >
      FOODCOOP.NEWS
    </a>
    <div aria-hidden="true" class="h-4 w-7"></div>
  </div>
  <div
    bind:this={mobileScrollRef}
    class="relative mx-auto flex h-10 max-w-3xl items-center justify-center gap-1 overflow-x-auto overflow-y-hidden border-b border-zinc-200 px-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:gap-2 md:overflow-visible"
  >
    <div class="flex items-center justify-center gap-1 md:gap-2">
      {#each navItems as item (item.href)}
        <a
          href={item.href}
          data-sveltekit-replacestate={shouldReplaceHistoryOnMobile ? 'true' : undefined}
          data-nav-href={item.href}
          class={`shrink-0 flex flex-row items-center justify-center rounded-lg px-2 py-2 transition-colors md:px-4 ${
            pathname === item.href ? 'text-black' : 'text-zinc-500 hover:text-black'
          }`}
        >
          <span data-nav-label class="inline-flex items-center">
            <span class="text-sm font-medium">{item.label}</span>
          </span>
        </a>
      {/each}

      <a
        href={aboutItem.href}
        data-sveltekit-replacestate={shouldReplaceHistoryOnMobile ? 'true' : undefined}
        data-nav-href={aboutItem.href}
        class={`shrink-0 flex flex-row items-center justify-center rounded-lg px-2 py-2 transition-colors md:hidden ${
          pathname === aboutItem.href ? 'text-black' : 'text-zinc-500 hover:text-black'
        }`}
      >
        <span data-nav-label class="inline-flex items-center">
          <span class="text-sm font-medium">{aboutItem.label}</span>
        </span>
      </a>

      <a
        href={aboutItem.href}
        data-sveltekit-replacestate={shouldReplaceHistoryOnMobile ? 'true' : undefined}
        data-nav-href={aboutItem.href}
        class={`hidden flex-row items-center justify-center rounded-lg px-2 py-2 transition-colors md:flex md:px-4 ${
          pathname === aboutItem.href ? 'text-black' : 'text-zinc-500 hover:text-black'
        }`}
      >
        <span data-nav-label class="inline-flex items-center">
          <span class="text-sm font-medium">{aboutItem.label}</span>
        </span>
      </a>

    </div>

    <span
      aria-hidden="true"
      class="pointer-events-none absolute top-0 left-0 h-0.5 bg-black transition-all duration-300 ease-out"
      style={`transform: translate(${activeIndicatorLeft}px, ${activeIndicatorTop}px); width: ${activeIndicatorWidth}px; opacity: ${
        showActiveIndicator ? 1 : 0
      };`}
    ></span>
  </div>
</nav>

{#if isSidebarOpen}
  <div
    data-swipe-interactive="true"
    class="fixed inset-0 z-50 h-[100dvh] min-h-[100svh] bg-zinc-900/35"
    role="presentation"
    onpointerdown={closeSidebar}
  >
    <div
      id="navigation-sidebar"
      class="fixed inset-y-0 left-0 flex h-[100dvh] min-h-[100svh] w-80 max-w-[calc(100vw-2rem)] flex-col border-r border-zinc-200 bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-[calc(env(safe-area-inset-top)+1.75rem)] shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-label="Navigation menu"
      tabindex="-1"
      onpointerdown={(event) => event.stopPropagation()}
      in:fly={{ x: -320, duration: 220 }}
      out:fly={{ x: -320, duration: 180 }}
    >
      <div>
        <p
          class="text-base leading-tight font-bold text-zinc-800"
          style="font-family: 'DIN 1451 Std Engschrift', 'DIN 1451 Engschrift', Bahnschrift, 'DIN Alternate', 'Franklin Gothic Medium', sans-serif;"
        >
          FOODCOOP.NEWS
        </p>
      </div>

      {#if isPending}
        <p class="mt-5 text-sm text-zinc-500">Loading account…</p>
      {:else if isAuthenticated}
        <div class="mt-5">
          <a
            href="/integrations"
            data-sveltekit-replacestate={shouldReplaceHistoryOnMobile ? 'true' : undefined}
            class="block rounded-md transition-colors hover:bg-zinc-100"
            onclick={closeSidebar}
          >
            {#if memberName.trim()}
              <p class="text-base font-semibold text-zinc-900">{memberName.trim()}</p>
              <p class="text-sm text-zinc-600 break-all">{userEmail || 'Signed in'}</p>
            {:else}
              <p class="text-base font-semibold text-zinc-900 break-all">{userEmail || 'Signed in'}</p>
            {/if}
            {#if memberId.trim()}
              <p class="font-mono text-sm text-zinc-600">{memberId.trim()}</p>
            {/if}
          </a>
          <p class="mt-2 text-sm text-zinc-700">
            <a
              href="/produce?filter=favorites"
              data-sveltekit-replacestate={shouldReplaceHistoryOnMobile ? 'true' : undefined}
              class="inline-flex items-center gap-1 rounded-sm hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-800/30"
              onclick={closeSidebar}
            >
              <span class="font-bold text-black">{produceFavoritesCount}</span>
              <span>favorites</span>
              <span aria-hidden="true">•</span>
              <span><span class="font-bold text-black">{produceFavoritesInStockCount}</span> in stock</span>
              <span aria-hidden="true">•</span>
              <span
                ><span class="font-bold text-black">{produceFavoritesOutOfStockCount}</span> out of
                stock</span
              >
            </a>
          </p>
        </div>
      {:else}
        <div class="mt-5 space-y-4">
          <p class="text-2xl leading-tight font-bold text-zinc-900">
            Stay in the loop with the Park Slope Food Coop
          </p>
          <div class="flex flex-wrap gap-2">
            <a
              href={getSignupHref()}
              class="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
            >
              Create Account
            </a>
            <a
              href={loginHref}
              class="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100"
            >
              Sign in
            </a>
          </div>
        </div>
      {/if}

      <div class="mt-4 border-t border-zinc-200 pt-4">
        {#each [...navItems, aboutItem] as item (item.href)}
          <a
            href={item.href}
            data-sveltekit-replacestate={shouldReplaceHistoryOnMobile ? 'true' : undefined}
            class={`flex items-center gap-3 rounded-md px-1 py-3 text-xl transition-colors hover:text-black ${
              normalizePathname(pathname) === item.href ? 'font-bold text-black' : 'font-normal text-zinc-700'
            }`}
            onclick={closeSidebar}
          >
            <span aria-hidden="true">{getNavIcon(item.icon)}</span>
            <span>{item.label}</span>
          </a>
        {/each}
      </div>

      {#if showSidebarInstallAppButton}
        <div class="mt-2 border-t border-zinc-200 pt-4">
          <button
            type="button"
            class="inline-flex w-full items-center justify-center rounded-lg bg-black px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
            onclick={openInstallPromptFromSidebar}
          >
            Add to home screen
          </button>
        </div>
      {/if}

      <div class="mt-auto border-t border-zinc-200 pt-4">
        <a
          href="mailto:rex.ledesma1@gmail.com?subject=foodcoop.news%20feedback"
          class="inline-flex w-full items-center justify-center rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100"
          onclick={closeSidebar}
        >
          Send feedback
        </a>
      </div>
    </div>
  </div>
{/if}
