<script lang="ts">
  import { onMount } from 'svelte';

  type ToastVariant = 'success' | 'error' | 'warning';

  type IntegrationToast = {
    id: number;
    variant: ToastVariant;
    message: string;
    visible: boolean;
  };

  type IntegrationsClientState = {
    isInitialLoading: boolean;
    showSticky: boolean;
    sessionPending: boolean;
    isSignedIn: boolean;
    memberId: string;
    displayFullName: string;
    isSaving: boolean;
    isGeneratingPass: boolean;
    isGeneratingGooglePass: boolean;
    calendarId: string;
    isCalendarModalOpen: boolean;
    calendarDisplayUrl: string;
    googleCalendarUrl: string;
    outlookCalendarUrl: string;
    selectedJobs: string[];
    jobSearch: string;
    isJobDropdownOpen: boolean;
    highlightedJobIndex: number;
    filteredJobOptions: string[];
    pushSupported: boolean;
    canManageNotifications: boolean;
    pushEnabled: boolean;
    pushLoading: boolean;
    isSendingTest: boolean;
    toasts: IntegrationToast[];
    onMemberNameChange: (value: string) => void;
    onMemberIdChange: (value: string) => void;
    onSave: () => Promise<void>;
    onAddToWallet: () => Promise<void>;
    onAddToGoogleWallet: () => Promise<void>;
    onOpenCalendarModal: () => void;
    onCloseCalendarModal: () => void;
    onCopyCalendarUrl: () => Promise<void>;
    onJobSearchChange: (value: string) => void;
    onJobSearchFocus: () => void;
    onJobSearchBlur: () => void;
    onJobSearchKeyDown: (event: KeyboardEvent) => void;
    onToggleJob: (job: string) => void;
    onRemoveJob: (job: string) => void;
    onHighlightJobIndex: (index: number) => void;
    onTogglePush: () => Promise<void>;
    onSendTestNotification: () => Promise<void>;
  };

  let {
    channel,
    initialState,
  }: {
    channel: string;
    initialState: IntegrationsClientState;
  } = $props();

  const SAMPLE_MEMBER_NAMES = [
    'Kasandra Scarlet',
    'Jack Mustard',
    'Diane White',
    'Jacob Green',
    'Henrietta Peacock',
    'Victor Plum',
    'Miles Meadow-Brook',
  ] as const;
  const DEMO_MEMBER_ID_MIN = 100;
  const DEMO_MEMBER_ID_MAX = 100000;
  const DEMO_PROFILE_CYCLE_MS = 4000;
  const DEMO_SWAP_DURATION_MS = Math.round(DEMO_PROFILE_CYCLE_MS * 0.16);
  const DEMO_SWAP_HALF_MS = DEMO_SWAP_DURATION_MS / 2;

  let isInitialLoading = $state(true);
  let sessionPending = $state(true);
  let isSignedIn = $state(false);
  let memberId = $state('');
  let displayFullName = $state('');
  let isSaving = $state(false);
  let isGeneratingPass = $state(false);
  let isGeneratingGooglePass = $state(false);
  let calendarId = $state('');
  let isCalendarModalOpen = $state(false);
  let googleCalendarUrl = $state('');
  let outlookCalendarUrl = $state('');
  let selectedJobs = $state<string[]>([]);
  let jobSearch = $state('');
  let isJobDropdownOpen = $state(false);
  let highlightedJobIndex = $state(0);
  let filteredJobOptions = $state<string[]>([]);
  let pushSupported = $state(false);
  let canManageNotifications = $state(false);
  let pushEnabled = $state(false);
  let pushLoading = $state(false);
  let isSendingTest = $state(false);
  let toasts = $state<IntegrationToast[]>([]);

  let onMemberNameChange = $state<(value: string) => void>(() : void => {});
  let onMemberIdChange = $state<(value: string) => void>(() : void => {});
  let onSave = $state<() => Promise<void>>(async () : Promise<void> => {});
  let onAddToWallet = $state<() => Promise<void>>(async () : Promise<void> => {});
  let onAddToGoogleWallet = $state<() => Promise<void>>(async () : Promise<void> => {});
  let onOpenCalendarModal = $state<() => void>(() : void => {});
  let onCloseCalendarModal = $state<() => void>(() : void => {});
  let onCopyCalendarUrl = $state<() => Promise<void>>(async () : Promise<void> => {});
  let onJobSearchChange = $state<(value: string) => void>(() : void => {});
  let onJobSearchFocus = $state<() => void>(() : void => {});
  let onJobSearchBlur = $state<() => void>(() : void => {});
  let onJobSearchKeyDown = $state<(event: KeyboardEvent) => void>(() : void => {});
  let onToggleJob = $state<(job: string) => void>(() : void => {});
  let onRemoveJob = $state<(job: string) => void>(() : void => {});
  let onHighlightJobIndex = $state<(index: number) => void>(() : void => {});
  let onTogglePush = $state<() => Promise<void>>(async () : Promise<void> => {});
  let onSendTestNotification = $state<() => Promise<void>>(async () : Promise<void> => {});

  let cardRef = $state<HTMLDivElement | null>(null);
  let shineRef = $state<HTMLDivElement | null>(null);
  let sampleNameIndex = $state(0);
  let sampleMemberId = $state(String(generateRandomMemberId()));
  let isSampleSwapping = $state(false);
  let isCardHovered = $state(false);
  let isMemberNameFocused = $state(false);
  let isMemberIdFocused = $state(false);
  let prefersReducedMotion = $state(false);
  let idleCardAnimationFrame: number | null = null;
  let sampleSwapMidTimeout: ReturnType<typeof setTimeout> | null = null;
  let sampleSwapEndTimeout: ReturnType<typeof setTimeout> | null = null;

  let paywallEmail = $state('');
  let paywallLoading = $state(false);
  let paywallError = $state('');

  let shouldShowSampleProfile = $derived(
    displayFullName.trim().length === 0 &&
      memberId.trim().length === 0 &&
      !isMemberNameFocused &&
      !isMemberIdFocused,
  );
  let shouldPauseSampleCycle = $derived(isMemberNameFocused || isMemberIdFocused);
  let shouldPauseIdleCard = $derived(isCardHovered || isMemberNameFocused || isMemberIdFocused);
  let visibleCardMemberName = $derived(
    shouldShowSampleProfile
      ? SAMPLE_MEMBER_NAMES[sampleNameIndex % SAMPLE_MEMBER_NAMES.length]
      : displayFullName,
  );
  let visibleCardMemberId = $derived(shouldShowSampleProfile ? sampleMemberId : memberId);

  function generateRandomMemberId() : number {
    return Math.floor(Math.random() * (DEMO_MEMBER_ID_MAX - DEMO_MEMBER_ID_MIN + 1)) + DEMO_MEMBER_ID_MIN;
  }

  function stopIdleCardAnimation() : void {
    if (idleCardAnimationFrame !== null) {
      cancelAnimationFrame(idleCardAnimationFrame);
      idleCardAnimationFrame = null;
    }
  }

  function clearSampleSwapTimers() : void {
    if (sampleSwapMidTimeout) {
      clearTimeout(sampleSwapMidTimeout);
      sampleSwapMidTimeout = null;
    }
    if (sampleSwapEndTimeout) {
      clearTimeout(sampleSwapEndTimeout);
      sampleSwapEndTimeout = null;
    }
  }

  function advanceSampleProfile() : void {
    if (isSampleSwapping) {return;}
    isSampleSwapping = true;

    sampleSwapMidTimeout = setTimeout(() : void => {
      sampleNameIndex = (sampleNameIndex + 1) % SAMPLE_MEMBER_NAMES.length;
      sampleMemberId = String(generateRandomMemberId());
      sampleSwapMidTimeout = null;
    }, DEMO_SWAP_HALF_MS);

    sampleSwapEndTimeout = setTimeout(() : void => {
      isSampleSwapping = false;
      sampleSwapEndTimeout = null;
    }, DEMO_SWAP_DURATION_MS);
  }

  function resetCardTransform() : void {
    if (cardRef) {
      cardRef.style.transform = 'rotateX(0deg) rotateY(0deg)';
    }
    if (shineRef) {
      shineRef.style.opacity = '0';
    }
  }

  function startIdleCardAnimation() : void {
    if (!cardRef || idleCardAnimationFrame !== null) {return;}
    const startedAt = performance.now();

    const animate = (timestamp: number) : void => {
      if (!cardRef) {
        idleCardAnimationFrame = null;
        return;
      }

      const t = (timestamp - startedAt) / 1000;
      const rotateX = Math.sin(t * 1.15) * 5.5;
      const rotateY = Math.cos(t * 0.9) * 8;
      const floatY = Math.sin(t * 1.45) * 3.5;
      cardRef.style.transform = `translateY(${floatY}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;

      if (shineRef) {
        const x = 50 + Math.cos(t * 0.9) * 24;
        const y = 42 + Math.sin(t * 1.15) * 19;
        shineRef.style.opacity = '0.62';
        shineRef.style.background = `radial-gradient(circle at ${x}% ${y}%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 50%)`;
      }

      idleCardAnimationFrame = requestAnimationFrame(animate);
    };

    idleCardAnimationFrame = requestAnimationFrame(animate);
  }

  async function handlePaywallSubmit(event: Event): Promise<void> {
    event.preventDefault();
    const trimmed = paywallEmail.trim();
    if (!trimmed) return;

    paywallLoading = true;
    paywallError = '';

    try {
      const response = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });

      if (!response.ok) {
        paywallError = 'Something went wrong. Please try again.';
        return;
      }

      const data = (await response.json()) as { exists: boolean };
      sessionStorage.setItem('auth:prefill-email', trimmed);

      if (data.exists) {
        window.location.href = '/login?next=%2Fintegrations';
      } else {
        window.location.href = '/signup?next=%2Fintegrations';
      }
    } catch {
      paywallError = 'Something went wrong. Please try again.';
    } finally {
      paywallLoading = false;
    }
  }

  function applyState(next: IntegrationsClientState) : void {
    isInitialLoading = next.isInitialLoading;
    sessionPending = next.sessionPending;
    isSignedIn = next.isSignedIn;
    memberId = next.memberId;
    displayFullName = next.displayFullName;
    isSaving = next.isSaving;
    isGeneratingPass = next.isGeneratingPass;
    isGeneratingGooglePass = next.isGeneratingGooglePass;
    calendarId = next.calendarId;
    isCalendarModalOpen = next.isCalendarModalOpen;
    googleCalendarUrl = next.googleCalendarUrl;
    outlookCalendarUrl = next.outlookCalendarUrl;
    selectedJobs = next.selectedJobs;
    jobSearch = next.jobSearch;
    isJobDropdownOpen = next.isJobDropdownOpen;
    highlightedJobIndex = next.highlightedJobIndex;
    filteredJobOptions = next.filteredJobOptions;
    pushSupported = next.pushSupported;
    canManageNotifications = next.canManageNotifications;
    pushEnabled = next.pushEnabled;
    pushLoading = next.pushLoading;
    isSendingTest = next.isSendingTest;
    toasts = next.toasts;

    onMemberNameChange = next.onMemberNameChange;
    onMemberIdChange = next.onMemberIdChange;
    onSave = next.onSave;
    onAddToWallet = next.onAddToWallet;
    onAddToGoogleWallet = next.onAddToGoogleWallet;
    onOpenCalendarModal = next.onOpenCalendarModal;
    onCloseCalendarModal = next.onCloseCalendarModal;
    onCopyCalendarUrl = next.onCopyCalendarUrl;
    onJobSearchChange = next.onJobSearchChange;
    onJobSearchFocus = next.onJobSearchFocus;
    onJobSearchBlur = next.onJobSearchBlur;
    onJobSearchKeyDown = next.onJobSearchKeyDown;
    onToggleJob = next.onToggleJob;
    onRemoveJob = next.onRemoveJob;
    onHighlightJobIndex = next.onHighlightJobIndex;
    onTogglePush = next.onTogglePush;
    onSendTestNotification = next.onSendTestNotification;
  }

  function handleStateUpdate(event: Event) : void {
    if (!(event instanceof CustomEvent)) {return;}
    applyState(event.detail as IntegrationsClientState);
  }

  function handleCardMouseEnter() : void {
    isCardHovered = true;
    stopIdleCardAnimation();
    resetCardTransform();
  }

  function handleCardMouseMove(event: MouseEvent) : void {
    isCardHovered = true;
    const target = event.currentTarget as HTMLDivElement;
    const rect = target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -8;
    const rotateY = ((x - centerX) / centerX) * 8;

    target.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;

    if (shineRef) {
      shineRef.style.opacity = '1';
      shineRef.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 50%)`;
    }
  }

  function handleCardMouseLeave(event: MouseEvent) : void {
    isCardHovered = false;
    const target = event.currentTarget as HTMLDivElement;
    target.style.transform = 'rotateX(0deg) rotateY(0deg)';
    if (shineRef) {
      shineRef.style.opacity = '0';
    }
  }

  onMount(() : () => void => {
    applyState(initialState);

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion = motionQuery.matches;
    const handleMotionPreferenceChange = (event: MediaQueryListEvent) : void => {
      prefersReducedMotion = event.matches;
    };
    motionQuery.addEventListener('change', handleMotionPreferenceChange);

    const handler = (event: Event) : void => handleStateUpdate(event);
    window.addEventListener(`integrations-state:update:${channel}`, handler as EventListener);

    return () : void => {
      window.removeEventListener(`integrations-state:update:${channel}`, handler as EventListener);
      motionQuery.removeEventListener('change', handleMotionPreferenceChange);
      stopIdleCardAnimation();
      clearSampleSwapTimers();
    };
  });

  $effect(() : void | (() => void) => {
    if (!shouldShowSampleProfile || shouldPauseSampleCycle) {return;}

    const timer = setInterval(() : void => {
      advanceSampleProfile();
    }, DEMO_PROFILE_CYCLE_MS);

    return () : void => {
      clearInterval(timer);
    };
  });

  $effect(() : void => {
    if (shouldShowSampleProfile) {return;}
    clearSampleSwapTimers();
    isSampleSwapping = false;
  });

  $effect(() : void | (() => void) => {
    const shouldAnimateIdleCard = shouldShowSampleProfile && !shouldPauseIdleCard && !prefersReducedMotion;

    if (!shouldAnimateIdleCard || !cardRef) {
      stopIdleCardAnimation();
      resetCardTransform();
      return;
    }

    startIdleCardAnimation();

    return () : void => {
      stopIdleCardAnimation();
      resetCardTransform();
    };
  });
</script>

<div class="flex min-h-screen flex-col">
  <div class="mx-auto flex w-full max-w-3xl grow flex-col px-4 pb-6">
    <div class="py-6">
      <h1 class="text-2xl font-bold text-zinc-900">Integrations</h1>
    </div>

    {#if isInitialLoading}
      <div class="animate-pulse">
        <div class="mb-6 h-8 w-32 rounded bg-zinc-200"></div>
        <div class="space-y-4">
          <div class="h-10 rounded bg-zinc-200"></div>
          <div class="h-10 rounded bg-zinc-200"></div>
        </div>
      </div>
    {:else}
      <form
        onsubmit={(event) => {
          event.preventDefault();
          void onSave();
        }}
        class="space-y-6"
      >
        <section class="space-y-4">
          <h2 class="text-lg font-semibold text-zinc-900">Profile</h2>

          <div class="w-full max-w-sm" style="perspective: 1000px;">
            <div
              bind:this={cardRef}
              class="relative aspect-[1.586/1] w-full overflow-hidden rounded-2xl shadow-xl transition-transform duration-300 ease-out hover:shadow-2xl"
              style="background-color: rgb(255, 246, 220); background-image: url('/assets/coop-strip.png'); background-position: center 12%; background-repeat: no-repeat; background-size: 20% auto; transform-style: preserve-3d;"
              role="img"
              aria-label="Apple Wallet member card preview"
              onmouseenter={handleCardMouseEnter}
              onmousemove={handleCardMouseMove}
              onmouseleave={handleCardMouseLeave}
            >
              <div bind:this={shineRef} class="pointer-events-none absolute inset-0 transition-opacity duration-300" style="opacity: 0;"></div>

              <div class="absolute top-4 right-4 left-4 flex items-start justify-between">
                <div class="flex items-center gap-2">
                  <img src="/assets/coop-padded.png" alt="Park Slope Food Coop" class="h-7 w-auto" />
                </div>
              </div>

              <div class="absolute top-1/3 right-4 left-4">
                <label for="cardMemberName" class="block text-[10px] tracking-wider uppercase" style="color: rgba(51, 51, 51, 0.6);">
                  MEMBER
                </label>
                <div class="group relative">
                  <input
                    type="text"
                    id="cardMemberName"
                    value={visibleCardMemberName}
                    oninput={(event) => onMemberNameChange((event.currentTarget as HTMLInputElement).value)}
                    onfocus={() => {
                      isMemberNameFocused = true;
                    }}
                    onblur={() => {
                      isMemberNameFocused = false;
                    }}
                    placeholder="Your Name"
                    class={`w-full rounded-t border-b border-dashed bg-transparent px-1 py-0.5 text-xl font-semibold transition-colors placeholder:text-zinc-400 focus:outline-none ${
                      shouldShowSampleProfile ? 'sample-name-shimmer' : ''
                    } ${shouldShowSampleProfile && isSampleSwapping ? 'sample-swap-fade' : ''} ${shouldShowSampleProfile ? 'sample-swap-transition' : ''}`}
                    style={`color: rgb(51, 51, 51); border-color: rgba(51, 51, 51, 0.35); --sample-shimmer-ms: ${DEMO_PROFILE_CYCLE_MS}ms; --sample-swap-half-ms: ${DEMO_SWAP_HALF_MS}ms;`}
                  />
                  <svg
                    class="pointer-events-none absolute top-1/2 right-1 h-4 w-4 -translate-y-1/2 transition-colors"
                    style="color: rgba(51, 51, 51, 0.35);"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                    <path d="m15 5 4 4"></path>
                  </svg>
                </div>
              </div>

              <div class="absolute right-4 bottom-[18%] left-4">
                <label for="cardMemberId" class="block text-[10px] tracking-wider uppercase" style="color: rgba(51, 51, 51, 0.6);">
                  MEMBER ID
                </label>
                <div class="group relative w-fit">
                  <input
                    type="text"
                    id="cardMemberId"
                    inputmode="numeric"
                    value={visibleCardMemberId}
                    oninput={(event) => onMemberIdChange((event.currentTarget as HTMLInputElement).value)}
                    onfocus={() => {
                      isMemberIdFocused = true;
                    }}
                    onblur={() => {
                      isMemberIdFocused = false;
                    }}
                    placeholder="000000"
                    class={`w-32 rounded-t border-b border-dashed bg-transparent px-1 py-0.5 text-xl font-semibold transition-colors placeholder:text-zinc-400 focus:outline-none ${
                      shouldShowSampleProfile ? 'sample-name-shimmer' : ''
                    } ${shouldShowSampleProfile && isSampleSwapping ? 'sample-swap-fade' : ''} ${shouldShowSampleProfile ? 'sample-swap-transition' : ''}`}
                    style={`color: rgb(51, 51, 51); border-color: rgba(51, 51, 51, 0.35); --sample-shimmer-ms: ${DEMO_PROFILE_CYCLE_MS}ms; --sample-swap-half-ms: ${DEMO_SWAP_HALF_MS}ms;`}
                  />
                  <svg
                    class="pointer-events-none absolute top-1/2 right-1 h-4 w-4 -translate-y-1/2 transition-colors"
                    style="color: rgba(51, 51, 51, 0.35);"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                    <path d="m15 5 4 4"></path>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div class="flex items-center gap-2">
          {#if isSignedIn}
            <button
              type="submit"
              disabled={isSaving}
              class="min-h-[34px] shrink-0 whitespace-nowrap rounded-lg bg-black px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:bg-zinc-400 disabled:opacity-60"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          {:else}
            <a
              href="/login?next=%2Fintegrations"
              class="flex min-h-[34px] shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-black px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
            >
              Sign in to save
            </a>
          {/if}
          <div class="flex gap-2">
            <button
              type="button"
              onclick={() => void onAddToWallet()}
              disabled={!isSignedIn || isGeneratingPass || !memberId || !displayFullName}
              class="transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              <img src="/apple-wallet.svg" alt="Add to Apple Wallet" class="h-[34px]" />
            </button>
            <button
              type="button"
              onclick={() => void onAddToGoogleWallet()}
              disabled={!isSignedIn || isGeneratingGooglePass || !memberId || !displayFullName}
              class="transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              <img src="/google-wallet.svg" alt="Add to Google Wallet" class="h-[34px]" />
            </button>
          </div>
        </div>
      </form>

      {@const isPaywalled = !isSignedIn && !sessionPending}
      <section class="mt-10">
        <h2 class="text-lg font-semibold text-zinc-900">Shift Calendar</h2>

        <div class="relative mt-6">
          <div
            class={`rounded-xl border border-zinc-200 bg-white p-4 transition-[filter,opacity] duration-200 ${isPaywalled ? 'pointer-events-none select-none blur-[5px] opacity-45 sm:blur-[2.5px] sm:opacity-60' : ''}`}
            inert={isPaywalled}
            aria-hidden={isPaywalled}
          >
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 class="text-base font-semibold text-zinc-900">Shift Calendar Syncing</h3>
                <p class="mt-1 text-sm text-zinc-600">
                  Sync the shift calendar with your Google, Outlook, or Apple calendar.
                </p>
              </div>
              <button
                type="button"
                onclick={onOpenCalendarModal}
                class="rounded-xl bg-black px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-800"
              >
                Add iCal subscription
              </button>
            </div>

            <div class="mt-6 space-y-3">
              <div class="space-y-1">
                <h3 class="text-base font-semibold text-zinc-900">Selected Shifts</h3>
                <p class="text-sm text-zinc-600">Filter the shift calendar for your preferred shifts.</p>
              </div>
              <div class="relative">
                <input
                  type="text"
                  value={jobSearch}
                  oninput={(event) =>
                    onJobSearchChange((event.currentTarget as HTMLInputElement).value)}
                  onfocus={onJobSearchFocus}
                  onblur={onJobSearchBlur}
                  onkeydown={(event) => onJobSearchKeyDown(event)}
                  placeholder="Search jobs"
                  class="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                />
                {#if isJobDropdownOpen}
                  <div class="absolute z-10 mt-2 w-full rounded-xl border border-zinc-200 bg-white shadow-lg">
                    <div class="max-h-48 overflow-y-auto">
                      {#if filteredJobOptions.length > 0}
                        {#each filteredJobOptions as job, index (job)}
                          {@const isSelected = selectedJobs.includes(job)}
                          {@const isHighlighted = index === highlightedJobIndex}
                          <button
                            type="button"
                            onclick={() => onToggleJob(job)}
                            onmouseenter={() => onHighlightJobIndex(index)}
                            class={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                              isSelected ? 'bg-green-50 text-green-700' : 'text-zinc-700 hover:bg-zinc-100'
                            } ${isHighlighted && !isSelected ? 'bg-zinc-100' : ''}`}
                          >
                            <span>{job}</span>
                            {#if isSelected}
                              <span class="text-xs">Selected</span>
                            {/if}
                          </button>
                        {/each}
                      {:else}
                        <div class="px-3 py-2 text-sm text-zinc-500">No matching jobs.</div>
                      {/if}
                    </div>
                  </div>
                {/if}
              </div>

              <div class="flex flex-wrap gap-2">
                {#if selectedJobs.length > 0}
                  {#each selectedJobs as job (job)}
                    <span
                      class="group inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-red-50 hover:text-red-700"
                    >
                      {job}
                      <button
                        type="button"
                        onclick={() => onRemoveJob(job)}
                        class="text-xs font-semibold text-zinc-400 transition-colors group-hover:text-red-600"
                        aria-label={`Remove ${job}`}
                      >
                        ×
                      </button>
                    </span>
                  {/each}
                {:else}
                  <span class="text-sm text-zinc-500">All shifts included.</span>
                {/if}
              </div>
            </div>
          </div>

          {#if isPaywalled}
            <div class="absolute inset-0 z-10 flex items-center justify-center p-3 sm:p-6">
              <div class="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white/95 p-6 shadow-2xl shadow-zinc-900/50 backdrop-blur-sm">
                <p class="text-center text-xl font-bold text-zinc-900">
                  Stay in the loop with the<br />Park Slope Food Coop.
                </p>
                <h2 class="mt-3 text-center text-xl font-bold text-zinc-900">Create an account, or log in.</h2>
                <p class="mt-2 text-center text-sm text-zinc-600">
                  Gain access to wallet passes, shift calendar subscriptions, and produce favorites.
                </p>

                <form onsubmit={(event) => void handlePaywallSubmit(event)} class="mt-6 space-y-3">
                  <div>
                    <label for="paywallEmail" class="block text-sm font-medium text-zinc-700">Email address</label>
                    <input
                      type="email"
                      id="paywallEmail"
                      bind:value={paywallEmail}
                      required
                      placeholder="you@example.com"
                      class="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-base text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500 focus:outline-none"
                    />
                  </div>

                  {#if paywallError}
                    <p class="text-sm text-red-600">{paywallError}</p>
                  {/if}

                  <button
                    type="submit"
                    disabled={paywallLoading}
                    class="w-full rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:bg-zinc-400"
                  >
                    {paywallLoading ? 'Checking...' : 'Continue'}
                  </button>
                </form>
              </div>
            </div>
          {/if}
        </div>
      </section>

      {#if pushSupported && canManageNotifications}
        <section class="mt-10">
          <h2 class="text-lg font-semibold text-zinc-900">Notifications</h2>
          <p class="mt-2 text-sm text-zinc-600">Receive push notifications from foodcoop.news.</p>

          <div class="mt-6 rounded-xl border border-zinc-200 bg-white p-4">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-base font-semibold text-zinc-900">Push Notifications</h3>
                <p class="mt-1 text-sm text-zinc-600">Get notified about updates and announcements.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={pushEnabled}
                aria-label="Toggle push notifications"
                disabled={pushLoading}
                onclick={() => void onTogglePush()}
                class={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out disabled:opacity-50 ${
                  pushEnabled ? 'bg-green-600' : 'bg-zinc-300'
                }`}
              >
                <span
                  class={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
                    pushEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                ></span>
              </button>
            </div>

            {#if pushEnabled}
              <div class="mt-4 border-t border-zinc-100 pt-4">
                <button
                  type="button"
                  onclick={() => void onSendTestNotification()}
                  disabled={isSendingTest}
                  class="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:bg-green-400 disabled:opacity-60"
                >
                  {isSendingTest ? 'Sending...' : 'Send test notification'}
                </button>
              </div>
            {/if}
          </div>
        </section>
      {/if}

    {/if}
  </div>

  {#if isCalendarModalOpen}
    <div class="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close calendar modal"
        onclick={onCloseCalendarModal}
        class="absolute inset-0 bg-black/40"
      ></button>
      <div class="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div>
          <h3 class="text-lg font-semibold text-zinc-900">📅 Add iCal subscription</h3>
          <p class="mt-2 text-sm text-zinc-600">
            Add the shift calendar to your calendar app to keep up with new shifts and updates.
          </p>
        </div>

        <div class="mt-6 space-y-3">
          <a
            href={googleCalendarUrl}
            target="_blank"
            rel="noreferrer"
            class="block w-full rounded-xl bg-[#0b57d0] px-4 py-2 text-center font-medium text-white transition-colors hover:bg-[#0842a0]"
          >
            Add to Google Calendar
          </a>
          <a
            href={outlookCalendarUrl}
            target="_blank"
            rel="noreferrer"
            class="block w-full rounded-xl bg-[#0F6CBD] px-4 py-2 text-center font-medium text-white transition-colors hover:bg-[#0c5a9e]"
          >
            Add to Outlook Calendar
          </a>
          <button
            type="button"
            onclick={() => void onCopyCalendarUrl()}
            disabled={!calendarId}
            class="w-full rounded-xl bg-zinc-100 px-4 py-2 font-medium text-zinc-500 transition-colors hover:text-zinc-700 disabled:opacity-60 disabled:hover:text-zinc-500"
          >
            Add URL to clipboard
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if toasts.length > 0}
    <div class="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 space-y-2">
      {#each toasts as toast (toast.id)}
        <div
          class={`rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium shadow-lg transition-all duration-300 ease-out ${
            toast.visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
          }`}
        >
          <span
            class={
              toast.variant === 'success'
                ? 'text-green-600'
                : toast.variant === 'warning'
                  ? 'text-amber-600'
                  : 'text-red-600'
            }
          >
            {toast.message}
          </span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .sample-name-shimmer {
    background-image: linear-gradient(
      110deg,
      rgba(51, 51, 51, 0.45) 30%,
      rgba(51, 51, 51, 0.92) 50%,
      rgba(51, 51, 51, 0.45) 70%
    );
    background-size: 220% 100%;
    background-position: 150% 0;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: sample-name-shimmer var(--sample-shimmer-ms, 4000ms) linear infinite;
  }

  .sample-swap-fade {
    opacity: 0.25;
  }

  .sample-swap-transition {
    transition: opacity var(--sample-swap-half-ms, 320ms) ease-in-out;
  }

  @keyframes sample-name-shimmer {
    from {
      background-position: 150% 0;
    }
    to {
      background-position: -60% 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sample-name-shimmer {
      animation: none;
      background-position: 50% 0;
    }
  }
</style>
