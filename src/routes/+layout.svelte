<script lang="ts">
  import { injectAnalytics } from '@vercel/analytics/sveltekit';
  import '../styles/globals.css';
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

  const faviconHref = `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="0.9em" font-size="90">📰</text></svg>',
  )}`;
  const SITE_NAME = 'foodcoop.news';
  const SITE_DESCRIPTION = 'Stay in the loop with the Park Slope Food Coop.';
  const OG_IMAGE_PATH = '/og.png';

  const channel = `nav-${Math.random().toString(36).slice(2)}`;
  const initialPathname = typeof window === 'undefined' ? '/' : window.location.pathname;
  type MemberProfileResponse = {
    profile: {
      memberName: string;
      memberId: string;
    } | null;
  };

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
  let documentTitle = SITE_NAME;
  let canonicalUrl = '';
  let ogImageUrl = '';

  function dispatchState() {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(`navigation-state:update:${channel}`, { detail: state }));
  }

  function decodeParam(value: string | null): string {
    if (!value) return '';
    try {
      return decodeURIComponent(value).trim();
    } catch {
      return value.trim();
    }
  }

  function formatProduceDate(value: string | null): string {
    if (!value) return '';
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return '';
    const [, year, month, day] = match;
    return `${month}-${day}-${year}`;
  }

  function computePageTitle(pathname: string, searchParams: URLSearchParams): string {
    if (pathname === '/produce') {
      const produceName = decodeParam(searchParams.get('name'));
      const isHashedProduceId = /^[a-f0-9]{7}$/i.test(produceName);
      if (produceName && !isHashedProduceId) {
        return `${produceName} · ${SITE_NAME}`;
      }

      const formattedDate = formatProduceDate(searchParams.get('date'));
      if (formattedDate) {
        return `Produce (${formattedDate}) · ${SITE_NAME}`;
      }

      return `Produce · ${SITE_NAME}`;
    }

    if (pathname === '/discover' || pathname === '/') return `Discover · ${SITE_NAME}`;
    if (pathname === '/integrations') return `Integrations · ${SITE_NAME}`;
    if (pathname === '/about') return `About · ${SITE_NAME}`;
    if (pathname === '/login') return `Login · ${SITE_NAME}`;
    if (pathname === '/signup') return `Signup · ${SITE_NAME}`;

    return SITE_NAME;
  }

  async function hydrateNavState() {
    try {
      const sessionResponse = await fetch('/api/auth/get-session');
      const session = sessionResponse.ok
        ? ((await sessionResponse.json()) as { user?: { name?: string; email?: string } } | null)
        : null;

      let memberProfile: MemberProfileResponse | null = null;

      if (session?.user) {
        const profileResponse = await fetch('/api/me/profile');
        if (profileResponse.ok) {
          memberProfile = (await profileResponse.json()) as MemberProfileResponse;
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
    injectAnalytics();
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

  $: documentTitle = computePageTitle($page.url.pathname, $page.url.searchParams);
  $: canonicalUrl = `${$page.url.origin}${$page.url.pathname}`;
  $: ogImageUrl = `${$page.url.origin}${OG_IMAGE_PATH}`;
</script>

<svelte:head>
  <title>{documentTitle}</title>
  <link rel="icon" href={faviconHref} />
  <link rel="canonical" href={canonicalUrl} />
  <meta name="description" content={SITE_DESCRIPTION} />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content={SITE_NAME} />
  <meta property="og:title" content={documentTitle} />
  <meta property="og:description" content={SITE_DESCRIPTION} />
  <meta property="og:url" content={$page.url.href} />
  <meta property="og:image" content={ogImageUrl} />
</svelte:head>

<Navigation {channel} {initialState} />

<div class="pt-24 md:pt-14">
  <slot />
</div>
