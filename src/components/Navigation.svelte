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

  let onToggleDropdown = $state<() => void>(() => {});
  let onCloseDropdown = $state<() => void>(() => {});
  let onSignOut = $state<() => Promise<void>>(async () => {});

  let desktopDropdownRef = $state<HTMLDivElement | null>(null);
  let mobileDropdownRef = $state<HTMLDivElement | null>(null);

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

  onMount(() => {
    applyState(initialState);

    const handler = (event: Event) => handleStateUpdate(event);
    window.addEventListener(`navigation-state:update:${channel}`, handler as EventListener);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener(`navigation-state:update:${channel}`, handler as EventListener);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  });
</script>

<nav
  class={`safe-area-pt fixed top-0 right-0 left-0 z-40 bg-gradient-to-b from-[#e6f3fc] via-[#e6f9f0] to-white transition-opacity duration-300 ease-in-out motion-reduce:transition-none ${
    showSticky ? 'opacity-100' : 'pointer-events-none opacity-0'
  }`}
>
  <div class="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 md:h-14 md:gap-2">
    <div class="-ml-2 flex items-center justify-start md:-ml-4 md:justify-center md:gap-2">
      {#each navItems as item (item.href)}
        <a
          href={item.href}
          class={`flex flex-row items-center justify-center gap-2 rounded-lg px-2 py-2 transition-colors md:px-4 ${
            pathname === item.href ? 'text-black' : 'text-zinc-500 hover:text-black'
          }`}
        >
          <span class="text-xl md:text-lg">{getNavIcon(item.icon)}</span>
          <span class="text-sm font-medium">{item.label}</span>
        </a>
      {/each}

      <a
        href={aboutItem.href}
        class={`hidden flex-row items-center justify-center gap-2 rounded-lg px-2 py-2 transition-colors md:flex md:px-4 ${
          pathname === aboutItem.href ? 'text-black' : 'text-zinc-500 hover:text-black'
        }`}
      >
        <span class="text-xl md:text-lg">{getNavIcon(aboutItem.icon)}</span>
        <span class="text-sm font-medium">{aboutItem.label}</span>
      </a>
    </div>

    {#if !isPending}
      <div class="relative hidden md:block" bind:this={desktopDropdownRef}>
        {#if isAuthenticated}
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
            class={`flex flex-row items-center justify-center gap-2 rounded-lg px-4 py-2 transition-colors ${
              pathname === '/login' ? 'text-black' : 'text-zinc-500 hover:text-black'
            }`}
          >
            <span class="text-xl md:text-lg">{getNavIcon('carrot')}</span>
            <span class="text-sm font-medium">Sign In</span>
          </a>
        {/if}
      </div>
    {/if}
  </div>

  <div class="mx-auto -ml-2 flex max-w-3xl items-center px-4 pb-2 md:hidden">
    <a
      href={aboutItem.href}
      class={`inline-flex flex-row items-center justify-center gap-2 rounded-lg px-2 py-1 transition-colors ${
        pathname === aboutItem.href ? 'text-black' : 'text-zinc-500 hover:text-black'
      }`}
    >
      <span class="text-xl md:text-lg">{getNavIcon(aboutItem.icon)}</span>
      <span class="text-sm font-medium">{aboutItem.label}</span>
    </a>

    {#if !isPending}
      {#if isAuthenticated}
        <div class="relative" bind:this={mobileDropdownRef}>
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
          class={`flex flex-row items-center justify-center gap-2 rounded-lg px-2 py-1 transition-colors ${
            pathname === '/login' ? 'text-black' : 'text-zinc-500 hover:text-black'
          }`}
        >
          <span class="text-xl md:text-lg">{getNavIcon('carrot')}</span>
          <span class="text-sm font-medium">Sign In</span>
        </a>
      {/if}
    {/if}
  </div>
</nav>
