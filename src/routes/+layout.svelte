<script lang="ts">
  import { goto, preloadData } from '$app/navigation';
  import { injectAnalytics } from '@vercel/analytics/sveltekit';
  import '../styles/globals.css';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import Navigation from '@/components/Navigation.svelte';
  import { signOut } from '@/lib/auth-client';
  import { withNextParam } from '@/lib/auth-redirect';
  import { prefetchProduceCache } from '@/lib/produce-cache-prefetch';
  import type { LayoutData } from './$types';
  import {
    getCurrentStickyVisibility,
    initStickyVisibility,
    setStickyVisibilityRoute,
  } from '@/lib/sticky-visibility';
  import { createSwipeNavigator } from '@/lib/swipe-navigator';

  const SITE_NAME = 'Park Slope Food Coop News';
  const SITE_DESCRIPTION = 'Stay in the loop with the Park Slope Food Coop.';
  const OG_IMAGE_PATH = '/og.png';
  const NEW_ARRIVALS_AMBER = 'rgb(255,246,220)';
  const PWA_INTERACTION_THRESHOLD = 3;
  const PWA_DISMISSED_STORAGE_KEY = 'foodcoop:pwa-install-dismissed';
  const PWA_INSTALL_DESCRIPTION =
    'This site has app functionality. Install foodcoop.news on your device for easy access.';
  const DOUBLE_TAP_DELAY_MS = 350;
  const SWIPE_NAV_ROUTES = ['/about', '/integrations', '/produce', '/'] as const;
  const SWIPE_CAPTURE_THRESHOLD_PX = 14;
  const SWIPE_MAX_VERTICAL_DRIFT_PX = 90;
  const SWIPE_PEEK_MAX_TRAVEL_RATIO = 0.88;
  const SWIPE_COMMIT_RATIO = 0.3;
  const SWIPE_SNAP_DURATION_MS = 220;

  const channel = `nav-${Math.random().toString(36).slice(2)}`;
  const initialPathname = typeof window === 'undefined' ? '/' : window.location.pathname;
  type MemberProfileResponse = {
    profile: {
      memberName: string;
      memberId: string;
    } | null;
  };

  type AuthNavMetadata = {
    isAuthenticated: boolean;
    memberName: string;
    memberId: string;
    userEmail: string;
  };

  const BRAND_FONT_FAMILY =
    "'DIN 1451 Std Engschrift', 'DIN 1451 Engschrift', Bahnschrift, 'DIN Alternate', 'Franklin Gothic Medium', sans-serif";

  export let data = {} as LayoutData;

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
    swipeFromPath: null as string | null,
    swipeToPath: null as string | null,
    swipeProgress: 0,
    isSwipeActive: false,
    onToggleDropdown: () : void => {
      state = { ...state, isDropdownOpen: !state.isDropdownOpen };
      dispatchState();
    },
    onCloseDropdown: () : void => {
      state = { ...state, isDropdownOpen: false };
      dispatchState();
    },
    onSignOut: async () : Promise<void> => {
      await signOut();
      const pathname = $page.url.pathname;
      location.href = withNextParam('/login', pathname);
    },
  };

  const initialState = state;
  let documentTitle = SITE_NAME;
  let pageDescription = SITE_DESCRIPTION;
  let canonicalUrl = '';
  let ogUrl = '';
  let ogImageUrl = '';
  let siteOrigin = '';
  let websiteJsonLd = '';
  let organizationJsonLd = '';
  let isPwaInstallReady = false;
  let pwaInstallElement: (HTMLElement & { showDialog?: (force?: boolean) => void; manualHowTo?: boolean }) | null = null;
  let shouldForcePwaInstallDialog = false;
  let shouldExpandPwaInstallHowTo = false;
  let hasAutoShownPwaInstall = false;
  let shouldOpenPwaInstallDialog = false;
  let hasDismissedPwaInstall = false;
  let isSwipePreviewMode = false;
  let swipePreviewUrl = '';
  let swipePreviewOffsetX = 0;
  let swipeForegroundOffsetX = 0;
  let isSwipeDragging = false;
  let isSwipeSnapAnimating = false;
  let swipeSnapTimer: ReturnType<typeof setTimeout> | null = null;
  let swipeCommitTimer: ReturnType<typeof setTimeout> | null = null;
  let authMetadataInFlight: Promise<AuthNavMetadata> | null = null;

  function serializeJsonLd(payload: unknown): string {
    return JSON.stringify(payload).replaceAll('<', '\\u003c');
  }

  function dispatchState() : void {
    if (typeof window === 'undefined') {return;}
    window.dispatchEvent(new CustomEvent(`navigation-state:update:${channel}`, { detail: state }));
  }

  function decodeParam(value: string | null): string {
    if (!value) {return '';}
    try {
      return decodeURIComponent(value).trim();
    } catch {
      return value.trim();
    }
  }

  function normalizePathname(pathname: string): string {
    if (pathname.length > 1 && pathname.endsWith('/')) {return pathname.slice(0, -1);}
    return pathname;
  }

  function getSignupHref(loginHref: string): string {
    const queryString = loginHref.split('?')[1] ?? '';
    const next = new URLSearchParams(queryString).get('next');
    if (!next) {return '/signup';}
    return `/signup?next=${encodeURIComponent(next)}`;
  }

  function isEditableElement(target: EventTarget | null): boolean {
    const element = target instanceof Element ? target : null;
    if (!element) {return false;}
    if (element.closest('[data-sparkline-interactive="true"], [data-swipe-interactive="true"]')) {
      return true;
    }
    if (element instanceof HTMLElement && element.isContentEditable) {return true;}

    const tagName = element.tagName.toLowerCase();
    return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
  }

  function getSwipeTarget(step: 1 | -1): string | null {
    const currentPathname = normalizePathname(window.location.pathname);
    const currentIndex = SWIPE_NAV_ROUTES.indexOf(
      currentPathname as (typeof SWIPE_NAV_ROUTES)[number],
    );
    if (currentIndex === -1) {return null;}
    return SWIPE_NAV_ROUTES[currentIndex + step] ?? null;
  }

  function getSwipePreviewRouteUrl(route: string): string {
    return `${route}?swipePreview=1`;
  }

  function getSwipeTransitionDurationMs(): number {
    if (isSwipeDragging) {return 0;}
    return isSwipeSnapAnimating ? SWIPE_SNAP_DURATION_MS : 0;
  }

  function clearSwipeSnapTimer() : void {
    if (!swipeSnapTimer) {return;}
    clearTimeout(swipeSnapTimer);
    swipeSnapTimer = null;
  }

  function clearSwipeCommitTimer() : void {
    if (!swipeCommitTimer) {return;}
    clearTimeout(swipeCommitTimer);
    swipeCommitTimer = null;
  }

  function resetNavSwipeState() : void {
    if (!state.isSwipeActive && state.swipeFromPath === null && state.swipeToPath === null) {return;}
    state = {
      ...state,
      swipeFromPath: null,
      swipeToPath: null,
      swipeProgress: 0,
      isSwipeActive: false,
    };
    dispatchState();
  }

  function resetSwipeVisualState() : void {
    clearSwipeSnapTimer();
    clearSwipeCommitTimer();
    isSwipeDragging = false;
    isSwipeSnapAnimating = false;
    swipePreviewUrl = '';
    swipeForegroundOffsetX = 0;
    swipePreviewOffsetX = 0;
    resetNavSwipeState();
  }

  function animateSwipeBack() : void {
    isSwipeDragging = false;
    isSwipeSnapAnimating = true;
    swipeForegroundOffsetX = 0;
    swipePreviewOffsetX = 0;
    clearSwipeSnapTimer();
    swipeSnapTimer = setTimeout(() : void => {
      isSwipeSnapAnimating = false;
      swipePreviewUrl = '';
      swipeSnapTimer = null;
    }, SWIPE_SNAP_DURATION_MS);
  }

  function formatProduceDate(value: string | null): string {
    if (!value) {return '';}
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {return '';}
    const [, year, month, day] = match;
    return `${month}-${day}-${year}`;
  }

  function computePageTitle(pathname: string, searchParams: URLSearchParams): string {
    if (pathname === '/produce') {
      const produceName = decodeParam(searchParams.get('name') ?? searchParams.get('produce'));
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

    if (pathname === '/discover' || pathname === '/') {return `News · ${SITE_NAME}`;}
    if (pathname === '/integrations') {return `Integrations · ${SITE_NAME}`;}
    if (pathname === '/about') {return `About · ${SITE_NAME}`;}
    if (pathname === '/login') {return `Login · ${SITE_NAME}`;}
    if (pathname === '/signup') {return `Signup · ${SITE_NAME}`;}

    return SITE_NAME;
  }

  function computePageDescription(pathname: string, searchParams: URLSearchParams): string {
    if (pathname === '/produce') {
      const produceName = decodeParam(searchParams.get('name') ?? searchParams.get('produce'));
      const isHashedProduceId = /^[a-f0-9]{7}$/i.test(produceName);
      if (produceName && !isHashedProduceId) {
        return `Track ${produceName} prices over time from Park Slope Food Coop produce inventory.`;
      }

      const formattedDate = formatProduceDate(searchParams.get('date'));
      if (formattedDate) {
        return `Explore Park Slope Food Coop produce prices and trends for ${formattedDate}.`;
      }

      return 'Explore price history, trends, and updates from Park Slope Food Coop produce inventory.';
    }

    if (pathname === '/discover' || pathname === '/') {
      return 'News from Park Slope Food Coop, including events, produce, and community updates in one feed.';
    }

    if (pathname === '/integrations') {
      return 'Set up personalized integrations for your Park Slope Food Coop membership.';
    }

    if (pathname === '/about') {
      return 'Learn how foodcoop.news helps Park Slope Food Coop members stay informed.';
    }

    if (pathname === '/login') {
      return 'Log in to foodcoop.news.';
    }

    if (pathname === '/signup') {
      return 'Create an account on foodcoop.news.';
    }

    return SITE_DESCRIPTION;
  }

  function applyAuthMetadata(metadata: AuthNavMetadata) : void {
    state = {
      ...state,
      pathname: $page.url.pathname,
      loginHref: withNextParam('/login', $page.url.pathname),
      isPending: false,
      isAuthenticated: metadata.isAuthenticated,
      memberName: metadata.memberName,
      memberId: metadata.memberId,
      userEmail: metadata.userEmail,
    };
    dispatchState();
  }

  async function fetchAuthMetadata(): Promise<AuthNavMetadata> {
    if (authMetadataInFlight) {
      return authMetadataInFlight;
    }

    authMetadataInFlight = (async () : Promise<AuthNavMetadata> => {
      const sessionResponse = await fetch('/api/auth/get-session', { cache: 'no-store' });
      const session = sessionResponse.ok
        ? ((await sessionResponse.json()) as { user?: { name?: string; email?: string } } | null)
        : null;

      let memberProfile: MemberProfileResponse | null = null;

      if (session?.user) {
        const profileResponse = await fetch('/api/me/profile', { cache: 'no-store' });
        if (profileResponse.ok) {
          memberProfile = (await profileResponse.json()) as MemberProfileResponse;
        }
      }

      const metadata: AuthNavMetadata = {
        isAuthenticated: Boolean(session?.user),
        memberName: memberProfile?.profile?.memberName || session?.user?.name || '',
        memberId: memberProfile?.profile?.memberId || '',
        userEmail: session?.user?.email || '',
      };
      return metadata;
    })();

    try {
      return await authMetadataInFlight;
    } finally {
      authMetadataInFlight = null;
    }
  }

  async function hydrateNavState() : Promise<void> {
    try {
      const fresh = await fetchAuthMetadata();
      applyAuthMetadata(fresh);
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

  $: isSwipePreviewMode = $page.url.searchParams.get('swipePreview') === '1';

  onMount(() : (() => void) | undefined => {
    if (isSwipePreviewMode) {
      return;
    }

    hasDismissedPwaInstall = localStorage.getItem(PWA_DISMISSED_STORAGE_KEY) === 'true';

    void import('@khmyznikov/pwa-install').then(() : void => {
      isPwaInstallReady = true;
    });

    injectAnalytics();
    initStickyVisibility($page.url.pathname);
    void prefetchProduceCache();

    const stickyVisibilityHandler = (event: Event) : void => {
      if (!(event instanceof CustomEvent)) {return;}
      state = { ...state, showSticky: Boolean(event.detail) };
      dispatchState();
    };
    const sidebarOpenedRevalidateHandler = () : void => {
      void hydrateNavState();
    };

    window.addEventListener('sticky-visibility', stickyVisibilityHandler as EventListener);
    window.addEventListener('navigation:sidebar-opened', sidebarOpenedRevalidateHandler);

    state = { ...state, showSticky: getCurrentStickyVisibility() };
    dispatchState();
    void hydrateNavState();

    const isStandaloneMode = () : boolean =>
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    let interactionCount = 0;
    let hasCountedScrollInteraction = false;

    const showPwaInstallDialog = (event?: Event) : void => {
      const eventDetail =
        event instanceof CustomEvent
          ? ((event.detail as { force?: boolean; expandHowTo?: boolean } | null) ?? null)
          : null;
      const forcePrompt = Boolean(eventDetail?.force);
      if (isStandaloneMode()) {return;}
      if (hasDismissedPwaInstall && !forcePrompt) {return;}
      shouldForcePwaInstallDialog = forcePrompt;
      shouldExpandPwaInstallHowTo = Boolean(eventDetail?.expandHowTo);
      shouldOpenPwaInstallDialog = true;
    };

    const handleInteraction = (event: Event) : void => {
      if (hasAutoShownPwaInstall) {return;}
      if (event.type === 'scroll') {
        if (hasCountedScrollInteraction) {return;}
        hasCountedScrollInteraction = true;
        window.removeEventListener('scroll', handleInteraction);
      }
      interactionCount += 1;
      if (interactionCount < PWA_INTERACTION_THRESHOLD) {return;}
      hasAutoShownPwaInstall = true;
      showPwaInstallDialog();
      window.removeEventListener('pointerdown', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('scroll', handleInteraction);
    };

    window.addEventListener('pointerdown', handleInteraction);
    window.addEventListener('keydown', handleInteraction);
    window.addEventListener('scroll', handleInteraction, { passive: true });
    window.addEventListener('pwa-install:show', showPwaInstallDialog);

    let lastTouchEndAt = 0;
    const preventDoubleTapZoom = (event: TouchEvent) : void => {
      if (event.touches.length > 0) {return;}
      const now = Date.now();
      if (now - lastTouchEndAt <= DOUBLE_TAP_DELAY_MS) {
        event.preventDefault();
      }
      lastTouchEndAt = now;
    };
    const preventDoubleClickZoom = (event: MouseEvent) : void => {
      event.preventDefault();
    };

    document.addEventListener('touchend', preventDoubleTapZoom, { passive: false });
    document.addEventListener('dblclick', preventDoubleClickZoom);

    const isMobileTouchInput = () : boolean =>
      window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

    const enforceMobileReplaceState = () : () => void => {
      if (!isMobileTouchInput()) {
        return () : void => {};
      }

      // On mobile, always replace history entries so iOS/Android edge-swipe
      // gestures cannot navigate backward/forward through app routes.
      const originalPushState = window.history.pushState;

      const mobileHistory = window.history as History & { pushState: History['pushState'] };
      mobileHistory.pushState = ((data: unknown, unused: string, url?: string | URL | null) : void => {
        window.history.replaceState(data, unused, url);
      }) as History['pushState'];

      return () : void => {
        mobileHistory.pushState = originalPushState;
      };
    };

    const restoreMobileHistoryBehavior = enforceMobileReplaceState();

    let isSwipeNavigationInFlight = false;
    let swipeActiveTargetRoute: string | null = null;
    const swipeNavigator = createSwipeNavigator({
      captureThresholdPx: SWIPE_CAPTURE_THRESHOLD_PX,
      maxVerticalDriftPx: SWIPE_MAX_VERTICAL_DRIFT_PX,
      peekMaxTravelRatio: SWIPE_PEEK_MAX_TRAVEL_RATIO,
      commitRatio: SWIPE_COMMIT_RATIO,
      getViewportWidth: () : number => Math.max(window.innerWidth, 1),
      canStart: () : boolean => !isSwipeNavigationInFlight,
      isMobileTouchInput,
      isEditableElement,
      getSwipeTarget,
      preloadRoute: (route) : void => {
        void preloadData(route);
      },
      onStart: () : void => {
        clearSwipeSnapTimer();
        clearSwipeCommitTimer();
        isSwipeDragging = false;
        isSwipeSnapAnimating = false;
        swipeForegroundOffsetX = 0;
        swipePreviewOffsetX = 0;
        swipeActiveTargetRoute = null;
        resetNavSwipeState();
      },
      onPreviewRoute: (route) : void => {
        const nextPreviewUrl = getSwipePreviewRouteUrl(route);
        if (swipePreviewUrl === nextPreviewUrl) {return;}
        swipePreviewUrl = nextPreviewUrl;
        swipeActiveTargetRoute = normalizePathname(route);
      },
      onDrag: ({ step, travelPx, progress }) : void => {
        isSwipeDragging = true;
        swipeForegroundOffsetX = step * travelPx;
        swipePreviewOffsetX = step === 1 ? -24 * (1 - progress) : 24 * (1 - progress);
        const swipeFromPath = normalizePathname(window.location.pathname);
        const swipeToPath = swipeActiveTargetRoute ?? getSwipeTarget(step);
        if (!swipeToPath) {return;}
        state = {
          ...state,
          swipeFromPath,
          swipeToPath: normalizePathname(swipeToPath),
          swipeProgress: progress,
          isSwipeActive: true,
        };
        dispatchState();
      },
      onNoTarget: () : void => {
        isSwipeDragging = false;
        swipeForegroundOffsetX = 0;
        swipePreviewOffsetX = 0;
        resetNavSwipeState();
      },
      onCommit: ({ step, route }) : void => {
        isSwipeDragging = false;
        isSwipeSnapAnimating = true;
        swipePreviewOffsetX = 0;
        swipeForegroundOffsetX = step * Math.max(window.innerWidth, 1);
        state = {
          ...state,
          swipeFromPath: normalizePathname(window.location.pathname),
          swipeToPath: normalizePathname(route),
          swipeProgress: 1,
          isSwipeActive: true,
        };
        dispatchState();
        isSwipeNavigationInFlight = true;
        clearSwipeCommitTimer();
        swipeCommitTimer = setTimeout(() : void => {
          swipeCommitTimer = null;
          void goto(route, {
            keepFocus: true,
            noScroll: true,
          }).finally(() : void => {
            isSwipeNavigationInFlight = false;
            resetSwipeVisualState();
          });
        }, SWIPE_SNAP_DURATION_MS);
      },
      onCancel: () : void => {
        animateSwipeBack();
        resetNavSwipeState();
      },
    });

    const { handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel } = swipeNavigator;
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });
    document.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () : void => {
      window.removeEventListener('sticky-visibility', stickyVisibilityHandler as EventListener);
      window.removeEventListener('navigation:sidebar-opened', sidebarOpenedRevalidateHandler);
      window.removeEventListener('pointerdown', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('scroll', handleInteraction);
      window.removeEventListener('pwa-install:show', showPwaInstallDialog);
      resetSwipeVisualState();
      restoreMobileHistoryBehavior();
      document.removeEventListener('touchend', preventDoubleTapZoom);
      document.removeEventListener('dblclick', preventDoubleClickZoom);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchCancel);
    };
  });

  function handlePwaUserChoiceResult(event: Event) : void {
    if (!(event instanceof CustomEvent)) {return;}
    if (event.detail?.message !== 'dismissed') {return;}

    hasDismissedPwaInstall = true;
    localStorage.setItem(PWA_DISMISSED_STORAGE_KEY, 'true');
  }

  $: if (typeof window !== 'undefined') {
    setStickyVisibilityRoute($page.url.pathname);
  }

  $: if (shouldOpenPwaInstallDialog && isPwaInstallReady && pwaInstallElement?.showDialog) {
    pwaInstallElement.manualHowTo = shouldExpandPwaInstallHowTo;
    pwaInstallElement.showDialog(shouldForcePwaInstallDialog);
    shouldOpenPwaInstallDialog = false;
    shouldForcePwaInstallDialog = false;
    shouldExpandPwaInstallHowTo = false;
  }

  $: documentTitle = computePageTitle($page.url.pathname, $page.url.searchParams);
  $: pageDescription = computePageDescription($page.url.pathname, $page.url.searchParams);
  $: canonicalUrl = `${data.canonicalOrigin}${$page.url.pathname}`;
  $: ogUrl = canonicalUrl;
  $: ogImageUrl = `${data.canonicalOrigin}${OG_IMAGE_PATH}`;
  $: siteOrigin = data.canonicalOrigin;
  $: websiteJsonLd = serializeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: siteOrigin,
  });
  $: organizationJsonLd = serializeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: siteOrigin,
    logo: `${siteOrigin}${OG_IMAGE_PATH}`,
  });
  $: showUnauthenticatedFooter = !isSwipePreviewMode && !state.isPending && !state.isAuthenticated;
  $: signupHref = getSignupHref(state.loginHref);
</script>

<svelte:head>
  <title>{documentTitle}</title>
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
  <link rel="manifest" href="/manifest.json" />
  <link rel="canonical" href={canonicalUrl} />
  <link rel="alternate" hreflang="en" href={canonicalUrl} />
  <meta name="description" content={pageDescription} />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content={SITE_NAME} />
  <meta property="og:title" content={documentTitle} />
  <meta property="og:description" content={pageDescription} />
  <meta property="og:url" content={ogUrl} />
  <meta property="og:image" content={ogImageUrl} />
  <svelte:element this={'script'} type="application/ld+json">{websiteJsonLd}</svelte:element>
  <svelte:element this={'script'} type="application/ld+json">
    {organizationJsonLd}
  </svelte:element>
</svelte:head>

{#if !isSwipePreviewMode}
  <Navigation {channel} {initialState} />
{/if}

<div
  class={`relative overflow-x-clip ${isSwipePreviewMode ? '' : 'pt-[5.5rem]'} ${
    showUnauthenticatedFooter ? 'pb-32' : ''
  }`}
>
  {#if swipePreviewUrl}
    <div
      class="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-white transition-transform ease-out motion-reduce:transition-none"
      style={`transform: translate3d(${swipePreviewOffsetX}px, 0, 0); transition-duration: ${getSwipeTransitionDurationMs()}ms;`}
    >
      <iframe
        title="Swipe preview"
        src={swipePreviewUrl}
        class="h-full w-full border-0"
        tabindex="-1"
      ></iframe>
      <div class="absolute inset-0 bg-white/8"></div>
    </div>
  {/if}
  <div
    class="relative z-10 bg-white transition-transform ease-out motion-reduce:transition-none"
    style={`transform: translate3d(${swipeForegroundOffsetX}px, 0, 0); transition-duration: ${getSwipeTransitionDurationMs()}ms;`}
  >
    <slot />
  </div>
</div>

{#if showUnauthenticatedFooter}
  <footer
    class="safe-area-pb fixed right-0 bottom-0 left-0 z-40 border-t border-zinc-200 bg-white"
  >
    <div class="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
      <a
        href="/"
        data-sveltekit-preload-data="hover"
        class="shrink-0 select-none text-base leading-none font-bold text-zinc-700"
        style={`font-family: ${BRAND_FONT_FAMILY};`}
      >
        FOODCOOP.NEWS
      </a>
      <div class="flex items-center gap-2">
        <a
          href={signupHref}
          class="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
        >
          Create account
        </a>
        <a
          href={state.loginHref}
          class="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100"
        >
          Sign in
        </a>
      </div>
    </div>
  </footer>
{/if}

{#if isPwaInstallReady && !isSwipePreviewMode}
  <pwa-install
    bind:this={pwaInstallElement}
    on:pwa-user-choice-result-event={handlePwaUserChoiceResult}
    install-description={PWA_INSTALL_DESCRIPTION}
    manual-apple
    manual-chrome
    use-local-storage
    manifest-url="/manifest.json"
    styles={JSON.stringify({ '--tint-color': NEW_ARRIVALS_AMBER })}
  ></pwa-install>
{/if}
