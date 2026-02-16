<script lang="ts">
  import '../app/globals.css';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import Navigation from '@/components/Navigation.svelte';
  import { signOut } from '@/lib/auth-client';
  import { withNextParam } from '@/lib/auth-redirect';
  import { prefetchProduceCache } from '@/lib/produce-cache-prefetch';
  import {
    getCurrentStickyVisibility,
    initStickyVisibility,
    setStickyVisibilityRoute,
  } from '@/lib/sticky-visibility';

  const channel = `nav-${Math.random().toString(36).slice(2)}`;
  const initialPathname = typeof window === 'undefined' ? '/' : window.location.pathname;

  let state = {
    pathname: initialPathname,
    loginHref: withNextParam('/login', initialPathname),
    showSticky: true,
    isPending: true,
    isAuthenticated: false,
    isDropdownOpen: false,
    memberName: '',
    memberId: '',
    userEmail: '',
    onToggleDropdown: () => {
      state = { ...state, isDropdownOpen: !state.isDropdownOpen };
      dispatchState();
    },
    onCloseDropdown: () => {
      state = { ...state, isDropdownOpen: false };
      dispatchState();
    },
    onSignOut: async () => {
      await signOut();
      const pathname = $page.url.pathname;
      location.href = withNextParam('/login', pathname);
    },
  };

  const initialState = state;

  function dispatchState() {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(`navigation-state:update:${channel}`, { detail: state }));
  }

  async function hydrateNavState() {
    try {
      const sessionResponse = await fetch('/api/auth/get-session');
      const session = sessionResponse.ok
        ? ((await sessionResponse.json()) as { user?: { name?: string; email?: string } } | null)
        : null;

      let memberProfile:
        | {
            profile: {
              memberName: string;
              memberId: string;
            } | null;
          }
        | null = null;

      if (session?.user) {
        const profileResponse = await fetch('/api/me/profile');
        if (profileResponse.ok) {
          memberProfile = (await profileResponse.json()) as typeof memberProfile;
        }
      }

      state = {
        ...state,
        pathname: $page.url.pathname,
        loginHref: withNextParam('/login', $page.url.pathname),
        isPending: false,
        isAuthenticated: Boolean(session?.user),
        memberName: memberProfile?.profile?.memberName || session?.user?.name || '',
        memberId: memberProfile?.profile?.memberId || '',
        userEmail: session?.user?.email || '',
      };
      dispatchState();
    } catch {
      state = {
        ...state,
        pathname: $page.url.pathname,
        loginHref: withNextParam('/login', $page.url.pathname),
        isPending: false,
      };
      dispatchState();
    }
  }

  $: if (typeof window !== 'undefined') {
    const pathname = $page.url.pathname;
    state = {
      ...state,
      pathname,
      loginHref: withNextParam('/login', pathname),
    };
    dispatchState();
  }

  onMount(() => {
    initStickyVisibility($page.url.pathname);
    void prefetchProduceCache();

    const stickyVisibilityHandler = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      state = { ...state, showSticky: Boolean(event.detail) };
      dispatchState();
    };

    window.addEventListener('sticky-visibility', stickyVisibilityHandler as EventListener);

    state = { ...state, showSticky: getCurrentStickyVisibility() };
    dispatchState();
    void hydrateNavState();

    return () => {
      window.removeEventListener('sticky-visibility', stickyVisibilityHandler as EventListener);
    };
  });

  $: if (typeof window !== 'undefined') {
    setStickyVisibilityRoute($page.url.pathname);
  }
</script>

<Navigation {channel} {initialState} />

<div class="pt-24 md:pt-14">
  <slot />
</div>
