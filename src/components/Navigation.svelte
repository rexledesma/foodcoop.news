<script lang="ts">
  import { onMount } from 'svelte';

  type NavigationClientState = {
    pathname: string;
    loginHref: string;
    showSticky: boolean;
    isPending: boolean;
    isAuthenticated: boolean;
    isDropdownOpen: boolean;
    memberName: string;
    memberId: string;
    userEmail: string;
    swipeFromPath: string | null;
    swipeToPath: string | null;
    swipeProgress: number;
    isSwipeActive: boolean;
    onToggleDropdown: () => void;
    onCloseDropdown: () => void;
    onSignOut: () => Promise<void>;
  };

  type NavIconName = 'compass' | 'produce' | 'carrot' | 'gear' | 'info';

  const navItems: { href: string; label: string; icon: NavIconName }[] = [
    { href: '/discover', label: 'Discover', icon: 'compass' },
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
  let isDropdownOpen = $state(false);
  let memberName = $state('');
  let memberId = $state('');
  let userEmail = $state('');
  let swipeFromPath = $state<string | null>(null);
  let swipeToPath = $state<string | null>(null);
  let swipeProgress = $state(0);
  let isSwipeActive = $state(false);

  let onToggleDropdown = $state<() => void>(() => {});
  let onCloseDropdown = $state<() => void>(() => {});
  let onSignOut = $state<() => Promise<void>>(async () => {});

  let desktopDropdownRef = $state<HTMLDivElement | null>(null);
  let mobileDropdownRef = $state<HTMLDivElement | null>(null);
  let mobileScrollRef = $state<HTMLDivElement | null>(null);
  let activeIndicatorLeft = $state(0);
  let activeIndicatorTop = $state(0);
  let activeIndicatorWidth = $state(0);
  let showActiveIndicator = $state(false);

  function getNavIcon(icon: NavIconName): string {
    switch (icon) {
      case 'compass':
        return '🧭';
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
    isDropdownOpen = next.isDropdownOpen;
    memberName = next.memberName;
    memberId = next.memberId;
    userEmail = next.userEmail;
    swipeFromPath = next.swipeFromPath;
    swipeToPath = next.swipeToPath;
    swipeProgress = next.swipeProgress;
    isSwipeActive = next.isSwipeActive;
    onToggleDropdown = next.onToggleDropdown;
    onCloseDropdown = next.onCloseDropdown;
    onSignOut = next.onSignOut;
  }

  function handleStateUpdate(event: Event) {
    if (!(event instanceof CustomEvent)) return;
    applyState(event.detail as NavigationClientState);
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target;
    if (!(target instanceof Node)) return;
    const inDesktop = desktopDropdownRef?.contains(target);
    const inMobile = mobileDropdownRef?.contains(target);
    if (!inDesktop && !inMobile) {
      onCloseDropdown();
    }
  }

  function isVisible(node: Element): node is HTMLElement {
    return node instanceof HTMLElement && node.getClientRects().length > 0;
  }

  function normalizePathname(path: string | null): string {
    if (!path) return '';
    if (path === '/') return '/discover';
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
    const fromTop = fromRect.bottom - containerRect.top + 4;
    const toTop = toRect ? toRect.bottom - containerRect.top + 4 : fromTop;

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
    applyState(initialState);

    const handler = (event: Event) => handleStateUpdate(event);
    window.addEventListener(`navigation-state:update:${channel}`, handler as EventListener);
    document.addEventListener('mousedown', handleClickOutside);

    const container = mobileScrollRef;
    const handleScroll = () => updateActiveRouteIndicator();
    const handleResize = () => updateActiveRouteIndicator();
    container?.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    requestAnimationFrame(updateActiveRouteIndicator);

    return () => {
      window.removeEventListener(`navigation-state:update:${channel}`, handler as EventListener);
      document.removeEventListener('mousedown', handleClickOutside);
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
</script>

<nav
  data-swipe-interactive="true"
  class={`safe-area-pt fixed top-0 right-0 left-0 z-40 bg-gradient-to-b from-[#e6f3fc] via-[#e6f9f0] to-white transition-opacity duration-300 ease-in-out motion-reduce:transition-none ${
    showSticky ? 'opacity-100' : 'pointer-events-none opacity-0'
  }`}
>
  <div
    bind:this={mobileScrollRef}
    class="relative mx-auto flex h-16 max-w-3xl items-center gap-1 overflow-x-auto px-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:h-14 md:justify-between md:gap-2 md:overflow-visible"
  >
    <div class="-ml-2 flex items-center justify-start gap-1 md:-ml-4 md:justify-center md:gap-2">
      {#each navItems as item (item.href)}
        <a
          href={item.href}
          data-nav-href={item.href}
          class={`shrink-0 flex flex-row items-center justify-center rounded-lg px-2 py-2 transition-colors md:px-4 ${
            pathname === item.href ? 'text-black' : 'text-zinc-500 hover:text-black'
          }`}
        >
          <span data-nav-label class="inline-flex items-center gap-2">
            <span class="text-xl md:text-lg">{getNavIcon(item.icon)}</span>
            <span class="text-sm font-medium">{item.label}</span>
          </span>
        </a>
      {/each}

      <a
        href={aboutItem.href}
        data-nav-href={aboutItem.href}
        class={`shrink-0 flex flex-row items-center justify-center rounded-lg px-2 py-2 transition-colors md:hidden ${
          pathname === aboutItem.href ? 'text-black' : 'text-zinc-500 hover:text-black'
        }`}
      >
        <span data-nav-label class="inline-flex items-center gap-2">
          <span class="text-xl md:text-lg">{getNavIcon(aboutItem.icon)}</span>
          <span class="text-sm font-medium">{aboutItem.label}</span>
        </span>
      </a>

      <a
        href={aboutItem.href}
        data-nav-href={aboutItem.href}
        class={`hidden flex-row items-center justify-center rounded-lg px-2 py-2 transition-colors md:flex md:px-4 ${
          pathname === aboutItem.href ? 'text-black' : 'text-zinc-500 hover:text-black'
        }`}
      >
        <span data-nav-label class="inline-flex items-center gap-2">
          <span class="text-xl md:text-lg">{getNavIcon(aboutItem.icon)}</span>
          <span class="text-sm font-medium">{aboutItem.label}</span>
        </span>
      </a>

      {#if isPending}
        <div
          class="shrink-0 flex flex-row items-center justify-center gap-2 rounded-lg px-2 py-1 text-zinc-400 md:hidden"
          aria-busy="true"
        >
          <span class="text-xl md:text-lg">{getNavIcon('carrot')}</span>
          <span class="text-sm font-medium">Sign In</span>
        </div>
      {:else if isAuthenticated}
        <div class="relative shrink-0 md:hidden" bind:this={mobileDropdownRef}>
          <button
            type="button"
            onclick={onToggleDropdown}
            class={`flex flex-row items-center justify-center gap-2 rounded-lg px-2 py-1 text-sm font-medium transition-colors ${
              isDropdownOpen ? 'text-black' : 'text-zinc-500 hover:text-black'
            }`}
          >
            <span class="text-xl md:text-lg">{getNavIcon('carrot')}</span>
            <span>Account</span>
          </button>

          {#if isDropdownOpen}
            <div class="absolute top-full left-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
              <div class="border-b border-zinc-200 p-4">
                <p class="font-medium text-zinc-900">{memberName}</p>
                {#if memberId}
                  <p class="mt-1 text-sm text-zinc-500">
                    Member ID: <span class="font-mono">{memberId}</span>
                  </p>
                {/if}
                <p class="mt-1 truncate text-sm text-zinc-500">{userEmail}</p>
              </div>
              <button
                type="button"
                onclick={onSignOut}
                class="w-full px-4 py-3 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100"
              >
                Sign Out
              </button>
            </div>
          {/if}
        </div>
      {:else}
        <a
          href={loginHref}
          data-nav-href="/login"
          class={`shrink-0 flex flex-row items-center justify-center rounded-lg px-2 py-1 transition-colors md:hidden ${
            pathname === '/login' ? 'text-black' : 'text-zinc-500 hover:text-black'
          }`}
        >
          <span data-nav-label class="inline-flex items-center gap-2">
            <span class="text-xl md:text-lg">{getNavIcon('carrot')}</span>
            <span class="text-sm font-medium">Sign In</span>
          </span>
        </a>
      {/if}
    </div>

    <span
      aria-hidden="true"
      class="pointer-events-none absolute top-0 left-0 h-0.5 bg-black transition-all duration-300 ease-out"
      style={`transform: translate(${activeIndicatorLeft}px, ${activeIndicatorTop}px); width: ${activeIndicatorWidth}px; opacity: ${
        showActiveIndicator ? 1 : 0
      };`}
    ></span>

    <div class="relative hidden shrink-0 md:block" bind:this={desktopDropdownRef}>
      {#if isPending}
        <div
          class="flex flex-row items-center justify-center gap-2 rounded-lg px-4 py-2 text-zinc-400"
          aria-busy="true"
        >
          <span class="text-xl md:text-lg">{getNavIcon('carrot')}</span>
          <span class="text-sm font-medium">Sign In</span>
        </div>
      {:else if isAuthenticated}
        <button
          type="button"
          onclick={onToggleDropdown}
          class={`flex flex-row items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            isDropdownOpen ? 'text-black' : 'text-zinc-500 hover:text-black'
          }`}
        >
          <span class="text-xl md:text-lg">{getNavIcon('carrot')}</span>
          <span>Account</span>
        </button>

        {#if isDropdownOpen}
          <div class="absolute top-full right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
            <div class="border-b border-zinc-200 p-4">
              <p class="font-medium text-zinc-900">{memberName}</p>
              {#if memberId}
                <p class="mt-1 text-sm text-zinc-500">
                  Member ID: <span class="font-mono">{memberId}</span>
                </p>
              {/if}
              <p class="mt-1 truncate text-sm text-zinc-500">{userEmail}</p>
            </div>
            <button
              type="button"
              onclick={onSignOut}
              class="w-full px-4 py-3 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100"
            >
              Sign Out
            </button>
          </div>
        {/if}
      {:else}
        <a
          href={loginHref}
          data-nav-href="/login"
          class={`flex flex-row items-center justify-center rounded-lg px-4 py-2 transition-colors ${
            pathname === '/login' ? 'text-black' : 'text-zinc-500 hover:text-black'
          }`}
        >
          <span data-nav-label class="inline-flex items-center gap-2">
            <span class="text-xl md:text-lg">{getNavIcon('carrot')}</span>
            <span class="text-sm font-medium">Sign In</span>
          </span>
        </a>
      {/if}
    </div>
  </div>
</nav>
