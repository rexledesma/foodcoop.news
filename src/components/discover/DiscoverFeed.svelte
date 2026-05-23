<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import type {
    FeedPost,
    GazetteArticle,
    GazetteDeadlineEvent,
    FoodCoopAnnouncement,
    FoodCoopCooksArticle,
    EventbriteEvent,
    FoodcoopEvent,
    ProduceEvent,
  } from '@/lib/types';
  import type { FeedItem } from '@/lib/discover-feed';
  import { getFeedItemKey } from '@/lib/discover-feed';

  type PrimaryFilterType = 'latest' | 'upcoming';
  type SourceFilterType =
    | 'foodcoop'
    | 'gazette'
    | 'bluesky'
    | 'foodcoopcooks'
    | 'wordsprouts'
    | 'concert-series'
    | 'produce';

  const PRIMARY_FILTER_OPTIONS: {
    value: PrimaryFilterType;
    label: string;
    compactLabel: string;
  }[] = [
    { value: 'latest', label: 'Latest', compactLabel: 'Latest' },
    { value: 'upcoming', label: 'Upcoming', compactLabel: 'Upcoming' },
  ];
  const SOURCE_FILTER_OPTIONS: { value: SourceFilterType; label: string; description?: string }[] = [
    {
      value: 'foodcoop',
      label: 'Announcements',
      description: 'News from the Coop',
    },
    {
      value: 'produce',
      label: 'Produce',
      description: 'Fresh produce updates and market notes',
    },
    {
      value: 'gazette',
      label: "Linewaiters' Gazette",
      description: 'Gazette stories and submission deadlines',
    },
    {
      value: 'bluesky',
      label: 'Bluesky',
      description: 'Social posts from the Coop feed',
    },
    {
      value: 'foodcoopcooks',
      label: 'Cooking',
      description: 'Food Coop Cooks articles and classes',
    },
    {
      value: 'wordsprouts',
      label: 'Wordsprouts',
      description: 'Writing events and workshop listings',
    },
    {
      value: 'concert-series',
      label: 'Concerts',
      description: 'Concert series performances and events',
    },
  ];

  const DISCOVER_MENU_PILL_BASE_CLASS =
    'inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium';

  type DiscoverFeedClientState = {
    items: FeedItem[];
    loading: boolean;
    error: string;
    pendingSources: number;
    showSticky: boolean;
    favoritesSnapshot: string;
    shiftFavoritesSnapshot: string;
    fetchFeeds: () => void;
  };
  type EventFeedItem = Extract<
    FeedItem,
    { type: 'foodcoopcooks-events' | 'wordsprouts-events' | 'concert-series-events' | 'gm-events' | 'foodcoop-orientation-events' | 'gazette-deadline' }
  >;
  type UpcomingShiftCount = {
    name: string;
    count: number;
  };
  type UpcomingShiftsResponse = {
    shifts?: UpcomingShiftCount[];
    totalUpcomingEvents?: number;
    asOf?: string;
  };

  let {
    channel,
    initialState,
  }: {
    channel: string;
    initialState: DiscoverFeedClientState;
  } = $props();

  let primaryFilter = $state<PrimaryFilterType>('latest');
  let sourceFilter = $state<SourceFilterType | null>(null);
  let items = $state<FeedItem[]>([]);
  let loading = $state(true);
  let error = $state('');
  let pendingSources = $state(0);
  let showSticky = $state(true);
  let favoritesSnapshot = $state('[]');
  let shiftFavoritesSnapshot = $state('[]');
  let fetchFeeds = $state<() => void>(() : void => {});
  let primaryMenuOpen = $state(false);
  let sourceMenuOpen = $state(false);
  let upcomingShiftsLoading = $state(true);
  let upcomingShiftsError = $state('');
  let upcomingShifts = $state<UpcomingShiftCount[]>([]);

  let filtersRef = $state<HTMLDivElement | null>(null);

  const favorites = $derived(parseFavorites(favoritesSnapshot));
  const shiftFavorites = $derived(parseFavorites(shiftFavoritesSnapshot));
  const normalizedShiftFavorites = $derived.by(() : Set<string> => {
    const normalized = new Set<string>();
    for (const favorite of shiftFavorites) {
      const value = normalizeShiftName(favorite);
      if (value) {
        normalized.add(value);
      }
    }
    return normalized;
  });

  const sourceFilteredItems = $derived.by(() : FeedItem[] =>
    items.filter((item) : boolean => {
      if (sourceFilter === null) {return true;}
      if (sourceFilter === 'foodcoopcooks') {
        return item.type === 'foodcoopcooks' || item.type === 'foodcoopcooks-events';
      }
      if (sourceFilter === 'wordsprouts') {
        return item.type === 'wordsprouts-events';
      }
      if (sourceFilter === 'concert-series') {
        return item.type === 'concert-series-events';
      }
      if (sourceFilter === 'foodcoop') {
        return (
          item.type === 'foodcoop' ||
          item.type === 'gm-events' ||
          item.type === 'foodcoop-orientation-events'
        );
      }
      if (sourceFilter === 'gazette') {
        return item.type === 'gazette' || item.type === 'gazette-deadline';
      }
      return item.type === sourceFilter;
    }),
  );

  const upcomingItems = $derived.by(() : EventFeedItem[] => {
    const now = new Date();
    return sourceFilteredItems
      .filter((item): item is EventFeedItem => isEventItem(item))
      .filter((item) : boolean => item.date >= now)
      .sort((a, b) : number => a.date.getTime() - b.date.getTime());
  });

  const upcomingFortnightEvents = $derived.by(() : EventFeedItem[] => {
    const now = new Date();
    const nextFourteenDays = new Date(now);
    nextFourteenDays.setDate(nextFourteenDays.getDate() + 14);
    return upcomingItems.filter((item) : boolean => item.date <= nextFourteenDays);
  });

  const latestCurrentItems = $derived.by(() : FeedItem[] => {
    const now = new Date();
    return sourceFilteredItems.filter((item) : boolean => !(isEventItem(item) && item.date >= now));
  });

  const displayedItems = $derived(
    primaryFilter === 'upcoming' ? upcomingItems : latestCurrentItems,
  );
  const usingDefaultFilters = $derived(primaryFilter === 'latest' && sourceFilter === null);

  const isInitialLoading = $derived(loading && items.length === 0);
  const isInitialError = $derived(Boolean(error) && items.length === 0);
  const showsUpcomingShiftsBySource = $derived(
    sourceFilter === null || sourceFilter === 'foodcoop',
  );
  const shouldShowUpcomingShiftsCard = $derived(
    primaryFilter === 'latest' &&
      showsUpcomingShiftsBySource &&
      !upcomingShiftsLoading &&
      !upcomingShiftsError &&
      upcomingShifts.length > 0,
  );
  const shouldShowUpcomingShiftsSkeleton = $derived(
    primaryFilter === 'latest' && showsUpcomingShiftsBySource && upcomingShiftsLoading,
  );

  function isEventItem(item: FeedItem) : item is EventFeedItem {
    return (
      item.type === 'foodcoopcooks-events' ||
      item.type === 'wordsprouts-events' ||
      item.type === 'concert-series-events' ||
      item.type === 'gm-events' ||
      item.type === 'foodcoop-orientation-events' ||
      item.type === 'gazette-deadline'
    );
  }

  function formatRelativeTime(date: Date): string | null {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {return 'just now';}
    if (diffMins < 60) {return `${diffMins}m ago`;}
    if (diffHours < 24) {return `${diffHours}h ago`;}
    if (diffDays < 7) {return `${diffDays}d ago`;}
    return null;
  }

  function formatExactDateTime(date: Date): string {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  function formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  function formatPublishedAt(date: Date): string {
    const relative = formatRelativeTime(date);
    if (!relative) {return formatExactDateTime(date);}
    return `${relative} · ${formatExactDateTime(date)}`;
  }

  function formatEventDateTime(startUtc: string, timezone: string): string {
    const date = new Date(startUtc);
    const now = new Date();

    const eventDateStr = date.toLocaleDateString('en-US', { timeZone: timezone });
    const todayStr = now.toLocaleDateString('en-US', { timeZone: timezone });

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toLocaleDateString('en-US', {
      timeZone: timezone,
    });

    const fullDateTime = date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
    });

    if (eventDateStr === todayStr) {
      return `Today, ${fullDateTime}`;
    }
    if (eventDateStr === tomorrowStr) {
      return `Tomorrow, ${fullDateTime}`;
    }

    return fullDateTime;
  }

  function formatGeneralMeetingDescriptionForNews(description?: string): string {
    if (!description) {
      return '';
    }

    const romanHeaderPattern = /^[IVXLCDM]+\.\s+/i;
    const topLevelItemPattern = /^Item\s+\d+\s*:/i;

    const topLevelLines = description
      .split(/\r?\n/)
      .map((line): string => line.trim())
      .filter((line): boolean => line.length > 0)
      .filter((line): boolean => romanHeaderPattern.test(line) || topLevelItemPattern.test(line))
      .map((line): string => (topLevelItemPattern.test(line) ? `\t${line}` : line));

    if (topLevelLines.length === 0) {
      return description;
    }

    return topLevelLines.join('\n');
  }

  function getPostUrl(uri: string): string {
    const parts = uri.replace('at://', '').split('/');
    const handle = parts[0];
    const postId = parts[parts.length - 1];
    return `https://bsky.app/profile/${handle}/post/${postId}`;
  }

  function parseFavorites(stored: string): Set<string> {
    if (!stored) {return new Set();}
    try {
      const parsed = JSON.parse(stored) as string[];
      return new Set(parsed);
    } catch {
      return new Set();
    }
  }

  function normalizeShiftName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\*+/g, '')
      .replace(/\p{Extended_Pictographic}/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isShiftFavorited(shiftName: string, savedShifts: Set<string>): boolean {
    const normalizedShiftName = normalizeShiftName(shiftName);
    if (!normalizedShiftName) {
      return false;
    }
    return savedShifts.has(normalizedShiftName);
  }

  function formatOrientationCardTitle(event: FoodcoopEvent): string {
    return event.title || 'Online Pre-registration for New Members';
  }

  function handleStateUpdate(event: Event) : void {
    if (!(event instanceof CustomEvent)) {return;}
    const next = event.detail as DiscoverFeedClientState;
    items = next.items;
    loading = next.loading;
    error = next.error;
    pendingSources = next.pendingSources;
    showSticky = next.showSticky;
    favoritesSnapshot = next.favoritesSnapshot;
    shiftFavoritesSnapshot = next.shiftFavoritesSnapshot;
    fetchFeeds = next.fetchFeeds;
  }

  function setPrimaryFilter(nextFilter: PrimaryFilterType) : void {
    primaryFilter = nextFilter;
    primaryMenuOpen = false;
  }

  function openUpcomingFilter() : void {
    primaryFilter = 'upcoming';
    primaryMenuOpen = false;
    sourceMenuOpen = false;
  }

  function upcomingEventSourceName(item: EventFeedItem): string {
    if (item.type === 'foodcoopcooks-events') {return 'Cooking';}
    if (item.type === 'wordsprouts-events') {return 'Wordsprouts';}
    if (item.type === 'concert-series-events') {return 'Concerts';}
    if (item.type === 'gm-events') {return 'General Meeting';}
    if (item.type === 'foodcoop-orientation-events') {return 'Orientation';}
    if (item.type === 'gazette-deadline') {return "Linewaiters' Gazette";}
    return 'Events';
  }

  function upcomingEventTitle(item: EventFeedItem): string {
    if (item.type === 'foodcoop-orientation-events') {
      return formatOrientationCardTitle(item.data);
    }
    return item.data.title;
  }

  function upcomingEventDateTime(item: EventFeedItem): string {
    if (item.type === 'gazette-deadline') {
      return formatExactDateTime(item.date);
    }
    return formatEventDateTime(item.data.startUtc, item.data.timezone);
  }

  function shouldHighlightUpcomingEventTitle(item: EventFeedItem): boolean {
    return item.type === 'foodcoop-orientation-events' || item.type === 'gm-events';
  }

  function setSourceFilter(nextFilter: SourceFilterType | null) : void {
    sourceFilter = nextFilter;
    primaryMenuOpen = false;
    sourceMenuOpen = false;
  }

  function resetFilters() : void {
    sourceFilter = null;
    primaryFilter = 'latest';
    primaryMenuOpen = false;
    sourceMenuOpen = false;
  }

  function primaryMenuLabel() : string {
    return PRIMARY_FILTER_OPTIONS.find((option) : boolean => option.value === primaryFilter)?.compactLabel ?? 'View';
  }

  function primaryMenuButtonClass() : string {
    return 'bg-black text-white';
  }

  function primaryOptionPillClass(option: PrimaryFilterType) : string {
    return primaryFilter === option
      ? 'bg-black text-white'
      : 'bg-zinc-100 text-zinc-700';
  }

  function sourceMenuLabel() : string {
    const selected = SOURCE_FILTER_OPTIONS.find((option) : boolean => option.value === sourceFilter);
    return selected ? selected.label : 'All';
  }

  function sourceMenuButtonClass() : string {
    return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
  }

  function sourceOptionPillClass(option: SourceFilterType | null) : string {
    return sourceFilter === option
      ? 'bg-blue-100 text-blue-800'
      : 'bg-zinc-100 text-zinc-700';
  }

  async function loadUpcomingShifts(): Promise<void> {
    upcomingShiftsLoading = true;
    upcomingShiftsError = '';
    try {
      const response = await fetch('/api/calendar/upcoming-shifts', { cache: 'no-store' });
      const payload = (await response.json().catch(() : Record<string, never> => ({}))) as UpcomingShiftsResponse;
      if (!response.ok) {
        upcomingShifts = [];
        upcomingShiftsError = 'Failed to load upcoming shifts';
        return;
      }

      const shifts = Array.isArray(payload.shifts)
        ? payload.shifts
            .filter(
              (shift): shift is UpcomingShiftCount =>
                Boolean(
                  shift &&
                    typeof shift.name === 'string' &&
                    shift.name.trim().length > 0 &&
                    typeof shift.count === 'number' &&
                    Number.isFinite(shift.count) &&
                    shift.count > 0,
                ),
            )
            .map((shift): UpcomingShiftCount => ({
              name: shift.name.trim(),
              count: shift.count,
            }))
        : [];
      upcomingShifts = shifts;
    } catch {
      upcomingShifts = [];
      upcomingShiftsError = 'Failed to load upcoming shifts';
    } finally {
      upcomingShiftsLoading = false;
    }
  }

  function openIntegrations() : void {
    void goto('/integrations');
  }

  onMount(() : () => void => {
    items = initialState.items;
    loading = initialState.loading;
    error = initialState.error;
    pendingSources = initialState.pendingSources;
    showSticky = initialState.showSticky;
    favoritesSnapshot = initialState.favoritesSnapshot;
    shiftFavoritesSnapshot = initialState.shiftFavoritesSnapshot;
    fetchFeeds = initialState.fetchFeeds;
    void loadUpcomingShifts();

    // Filters intentionally do not persist; always default to All + Latest.

    const handler = (event: Event) : void => handleStateUpdate(event);
    window.addEventListener(`discover-feed-state:update:${channel}`, handler as EventListener);
    const handlePointerDown = (event: MouseEvent | TouchEvent) : void => {
      const target = event.target;
      if (!(target instanceof Element)) {return;}
      if (
        primaryMenuOpen &&
        !target.closest('[data-discover-primary-menu="true"]') &&
        !target.closest('[data-discover-primary-trigger="true"]')
      ) {
        primaryMenuOpen = false;
      }
      if (!sourceMenuOpen) {return;}
      if (
        target.closest('[data-discover-source-menu="true"]') ||
        target.closest('[data-discover-source-trigger="true"]')
      ) {
        return;
      }
      sourceMenuOpen = false;
    };
    const handleKeyDown = (event: KeyboardEvent) : void => {
      if (event.key !== 'Escape') {return;}
      primaryMenuOpen = false;
      sourceMenuOpen = false;
    };
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('touchstart', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () : void => {
      window.removeEventListener(
        `discover-feed-state:update:${channel}`,
        handler as EventListener,
      );
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  });

  $effect(() : (() => void) | undefined => {
    const element = filtersRef;
    if (!element || typeof ResizeObserver === 'undefined') {return;}

    const updateHeight = () : void => {
      window.dispatchEvent(new CustomEvent('sticky-threshold', { detail: element.offsetHeight }));
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);

    return () : void => observer.disconnect();
  });
</script>

<div class="mx-auto max-w-3xl px-4 pb-6">
  <div
    bind:this={filtersRef}
    class={`sticky top-[5.5rem] z-20 bg-white transition-opacity duration-250 ease-in-out motion-reduce:transition-none ${showSticky ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
  >
    <h1 class="py-6 text-2xl font-bold text-zinc-900">News</h1>
    <div class="pb-4">
      {#if isInitialLoading}
        <div class="space-y-3">
          <div class="flex gap-1">
            <div class="feed-shimmer h-8 flex-1 rounded-full"></div>
            <div class="feed-shimmer h-8 flex-1 rounded-full"></div>
          </div>
          <div class="feed-shimmer h-5 w-40 rounded-full"></div>
        </div>
      {:else}
          <div class="flex gap-1">
          <div class="relative min-w-0 flex-[1.15] sm:w-32 sm:flex-none">
            <button
              type="button"
              onclick={() => {
                sourceMenuOpen = false;
                sourceMenuOpen = !sourceMenuOpen;
                primaryMenuOpen = false;
              }}
              aria-expanded={sourceMenuOpen}
              data-discover-source-trigger="true"
              class={`inline-flex w-full items-center justify-between gap-1 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${sourceMenuButtonClass()}`}
            >
              <span class="truncate">{sourceMenuLabel()}</span>
              <span aria-hidden="true" class="text-[10px] text-blue-800/80">▼</span>
            </button>

            {#if sourceMenuOpen}
              <div
                class="absolute top-full left-0 z-40 mt-2 max-h-[min(26rem,calc(100vh-9rem))] w-[min(18rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-y-auto overflow-x-hidden rounded-2xl border border-zinc-200 bg-white py-1 shadow-[0_16px_50px_-24px_rgba(0,0,0,0.45)] sm:left-0"
                data-discover-source-menu="true"
                style="right: min(0px, calc(100% - 100vw + 2rem));"
              >
                <div class="px-4 py-2 text-xs font-semibold tracking-[0.08em] text-zinc-500 uppercase">
                  Source by
                </div>
                <button
                  type="button"
                  onclick={() => setSourceFilter(null)}
                  class={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-zinc-50 ${sourceFilter === null ? 'bg-zinc-50' : ''}`}
                >
                  <span class={`${DISCOVER_MENU_PILL_BASE_CLASS} ${sourceOptionPillClass(null)}`}>All</span>
                  {#if sourceFilter === null}
                    <span aria-hidden="true" class="text-sm text-zinc-700">✓</span>
                  {/if}
                </button>
                {#each SOURCE_FILTER_OPTIONS as option (option.value)}
                  <button
                    type="button"
                    onclick={() => setSourceFilter(option.value)}
                    class={`flex w-full items-start justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-zinc-50 ${sourceFilter === option.value ? 'bg-zinc-50' : ''}`}
                  >
                    <span class="min-w-0">
                      <span class={`${DISCOVER_MENU_PILL_BASE_CLASS} ${sourceOptionPillClass(option.value)}`}>
                        {option.label}
                      </span>
                      {#if option.description}
                        <span class="mt-0.5 block text-xs leading-5 text-zinc-500">{option.description}</span>
                      {/if}
                    </span>
                    {#if sourceFilter === option.value}
                      <span aria-hidden="true" class="pt-0.5 text-sm text-zinc-700">✓</span>
                    {/if}
                  </button>
                {/each}
              </div>
            {/if}
          </div>

          <div class="relative min-w-0 flex-[0.85] sm:w-32 sm:flex-none">
            <button
              type="button"
              onclick={() => {
                primaryMenuOpen = !primaryMenuOpen;
                sourceMenuOpen = false;
              }}
              aria-expanded={primaryMenuOpen}
              data-discover-primary-trigger="true"
              class={`inline-flex w-full items-center justify-between gap-1 rounded-full px-2.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors sm:px-3 ${primaryMenuButtonClass()}`}
            >
              <span class="truncate whitespace-nowrap">{primaryMenuLabel()}</span>
              <span
                aria-hidden="true"
                class="text-[10px] text-white/80"
              >
                ▼
              </span>
            </button>

            {#if primaryMenuOpen}
              <div
                class="absolute top-full right-0 z-40 mt-2 w-[min(18rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-zinc-200 bg-white py-1 shadow-[0_16px_50px_-24px_rgba(0,0,0,0.45)]"
                data-discover-primary-menu="true"
              >
                <div class="px-4 py-2 text-xs font-semibold tracking-[0.08em] text-zinc-500 uppercase">
                  Range by
                </div>
                {#each PRIMARY_FILTER_OPTIONS as option (option.value)}
                  <button
                    type="button"
                    onclick={() => setPrimaryFilter(option.value)}
                    class={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-zinc-50 ${primaryFilter === option.value ? 'bg-zinc-50' : ''}`}
                  >
                    <span class={`${DISCOVER_MENU_PILL_BASE_CLASS} whitespace-nowrap ${primaryOptionPillClass(option.value)}`}>
                      {option.label}
                    </span>
                    {#if primaryFilter === option.value}
                      <span aria-hidden="true" class="text-sm text-zinc-700">✓</span>
                    {/if}
                  </button>
                {/each}
              </div>
            {/if}
          </div>
          <button
            type="button"
            onclick={resetFilters}
            class={`inline-flex flex-none items-center justify-center rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium whitespace-nowrap text-zinc-700 transition-colors hover:bg-zinc-100 ${usingDefaultFilters ? 'invisible pointer-events-none' : ''}`}
            aria-label="Reset filters to All and Latest"
            disabled={usingDefaultFilters}
            aria-hidden={usingDefaultFilters}
            tabindex={usingDefaultFilters ? -1 : 0}
          >
            Reset
          </button>
        </div>

        {#if !isInitialError}
          <div class="p-2 text-sm text-zinc-500">Showing {displayedItems.length} of {items.length} items</div>
        {/if}
      {/if}
    </div>
  </div>

  <div class="transition-opacity duration-300 ease-in-out motion-reduce:transition-none">
    {#if isInitialLoading}
      <div class="grid gap-4 [&>*]:min-w-0">
        {@render FeedItemSkeleton()}
        {@render FeedItemSkeleton()}
        {@render FeedItemSkeleton()}
      </div>
    {:else if isInitialError}
      <div class="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
        {error}
        <button type="button" onclick={fetchFeeds} class="ml-2 underline hover:no-underline">
          Retry
        </button>
      </div>
    {:else}
      <div class="grid gap-4 [&>*]:min-w-0">
        {#if primaryFilter === 'latest' && upcomingFortnightEvents.length > 0}
          <div class="feed-item-enter min-w-0">
            {@render UpcomingWeekSummaryCard({
              count: upcomingFortnightEvents.length,
              events: upcomingFortnightEvents,
              onOpenUpcoming: openUpcomingFilter,
            })}
          </div>
        {/if}

        {#if shouldShowUpcomingShiftsCard}
          <div class="feed-item-enter min-w-0">
            {@render UpcomingShiftsCard({
              shifts: upcomingShifts,
              shiftFavorites: normalizedShiftFavorites,
              onOpenIntegrations: openIntegrations,
            })}
          </div>
        {/if}
        {#if shouldShowUpcomingShiftsSkeleton}
          <div class="feed-item-enter min-w-0">
            {@render UpcomingShiftsSkeletonCard()}
          </div>
        {/if}

        {#if primaryFilter === 'latest' && upcomingFortnightEvents.length > 0}
          <div class="flex items-center gap-3 px-1 py-1" aria-label="Now">
            <div class="h-px flex-1 bg-zinc-200"></div>
            <span class="text-xs font-semibold tracking-[0.08em] text-zinc-500 uppercase">Now</span>
            <div class="h-px flex-1 bg-zinc-200"></div>
          </div>
        {/if}

        {#each displayedItems as item (getFeedItemKey(item))}
          <div class="feed-item-enter min-w-0">
            {@render FeedCard({ item, favorites })}
          </div>
        {/each}

        {#if items.length > 0 && pendingSources > 0}
          {@render FeedItemSkeleton()}
        {/if}
      </div>

      {#if displayedItems.length === 0 && pendingSources === 0 && !(primaryFilter === 'latest' && upcomingFortnightEvents.length > 0) && !shouldShowUpcomingShiftsCard && !shouldShowUpcomingShiftsSkeleton}
        <p class="py-8 text-center text-zinc-500">No items found.</p>
      {/if}
    {/if}
  </div>
</div>

{#snippet FeedCard({ item, favorites }: { item: FeedItem; favorites: Set<string> })}
  {#if item.type === 'gazette'}
    {@render GazetteCard({ article: item.data })}
  {:else if item.type === 'gazette-deadline'}
    {@render GazetteDeadlineCard({ deadline: item.data })}
  {:else if item.type === 'foodcoop'}
    {@render FoodCoopCard({ article: item.data })}
  {:else if item.type === 'foodcoopcooks'}
    {@render FoodCoopCooksCard({ article: item.data })}
  {:else if item.type === 'foodcoopcooks-events'}
    {@render EventbriteEventCard({ event: item.data, label: "Cooking", emoji: "🧑‍🍳" })}
  {:else if item.type === 'wordsprouts-events'}
    {@render EventbriteEventCard({ event: item.data, label: "Wordsprouts", emoji: "🌱" })}
  {:else if item.type === 'concert-series-events'}
    {@render EventbriteEventCard({ event: item.data, label: "Concerts", emoji: "🎶" })}
  {:else if item.type === 'gm-events'}
    {@render EventbriteEventCard({
      event: item.data,
      label: "General Meeting",
      emoji: "🗳️",
      highlightTitle: true,
    })}
  {:else if item.type === 'foodcoop-orientation-events'}
    {@render EventbriteEventCard({
      event: item.data,
      label: "Orientation",
      emoji: "🧭",
      titleOverride: formatOrientationCardTitle(item.data),
      datePrefix: "Opens",
      highlightTitle: true,
    })}
  {:else if item.type === 'produce'}
    {@render ProduceCard({ update: item.data, date: item.date, favorites })}
  {:else}
    {@render BlueskyCard({ post: item.data })}
  {/if}
{/snippet}

{#snippet UpcomingWeekSummaryCard({
  count,
  events,
  onOpenUpcoming,
}: {
  count: number;
  events: EventFeedItem[];
  onOpenUpcoming: () => void;
})}
  <button
    type="button"
    onclick={onOpenUpcoming}
    class="block w-full rounded-xl border border-zinc-200 bg-white p-4 text-left transition-colors hover:border-zinc-400 hover:bg-zinc-50"
  >
    <div class="flex items-start gap-3">
      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xl">📅</div>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-semibold text-zinc-900">Upcoming Events</span>
          <span class="shrink-0 text-sm text-zinc-400">Next 14 days</span>
        </div>
        <p class="mt-2 font-medium text-zinc-700">
          {count} event{count === 1 ? '' : 's'} coming up next
        </p>
        <ul class="mt-2 list-disc space-y-2 pl-5 text-sm text-zinc-600">
          {#each events as event (getFeedItemKey(event))}
            <li>
              <p
                class={shouldHighlightUpcomingEventTitle(event)
                  ? 'inline rounded bg-amber-100 px-1 font-medium text-amber-900'
                  : 'font-medium text-zinc-800'}
              >
                {upcomingEventTitle(event)}
              </p>
              <p class="text-xs text-zinc-500">{upcomingEventSourceName(event)} · {upcomingEventDateTime(event)}</p>
            </li>
          {/each}
        </ul>
      </div>
    </div>
  </button>
{/snippet}

{#snippet UpcomingShiftsCard({
  shifts,
  shiftFavorites,
  onOpenIntegrations,
}: {
  shifts: UpcomingShiftCount[];
  shiftFavorites: Set<string>;
  onOpenIntegrations: () => void;
})}
  <button
    type="button"
    onclick={onOpenIntegrations}
    class="block w-full rounded-xl border border-zinc-200 bg-white p-4 text-left transition-colors hover:border-zinc-400 hover:bg-zinc-50"
  >
    <div class="flex items-start gap-3">
      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xl">🧩</div>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-semibold text-zinc-900">Upcoming Shifts</span>
          <span class="shrink-0 text-sm text-zinc-400">Next 6 weeks</span>
        </div>
        <div class="mt-3">
          <div class="flex flex-wrap gap-1.5">
            {#each shifts as shift, index (shift.name)}
              {@const isFavorited = isShiftFavorited(shift.name, shiftFavorites)}
              <span
                class={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                  index < 5 || isFavorited
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-sky-100 text-sky-900'
                }`}
              >
                {#if isFavorited}
                  <span class="text-[12px] leading-none text-amber-700">♥</span>
                {/if}
                <span class={isFavorited ? 'font-bold' : ''}>{shift.name}</span>
                <span class="font-semibold">{shift.count}</span>
              </span>
            {/each}
          </div>
        </div>
      </div>
    </div>
  </button>
{/snippet}

{#snippet UpcomingShiftsSkeletonCard()}
  <div class="rounded-xl border border-zinc-200 bg-white p-4">
    <div class="flex items-start gap-3">
      <div class="feed-shimmer h-10 w-10 shrink-0 rounded-full"></div>
      <div class="min-w-0 flex-1 space-y-3">
        <div class="flex items-center gap-2">
          <div class="feed-shimmer h-5 w-32 rounded-full"></div>
          <div class="feed-shimmer h-4 w-24 rounded-full"></div>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <div class="feed-shimmer h-5 w-[5.5rem] rounded-full"></div>
          <div class="feed-shimmer h-5 w-[6.5rem] rounded-full"></div>
          <div class="feed-shimmer h-5 w-20 rounded-full"></div>
          <div class="feed-shimmer h-5 w-28 rounded-full"></div>
          <div class="feed-shimmer h-5 w-16 rounded-full"></div>
          <div class="feed-shimmer h-5 w-[7.5rem] rounded-full"></div>
          <div class="feed-shimmer h-5 w-[4.75rem] rounded-full"></div>
          <div class="feed-shimmer h-5 w-[6.75rem] rounded-full"></div>
          <div class="feed-shimmer h-5 w-[5.25rem] rounded-full"></div>
          <div class="feed-shimmer h-5 w-[7rem] rounded-full"></div>
        </div>
      </div>
    </div>
  </div>
{/snippet}

{#snippet FeedItemSkeleton()}
  <div class="rounded-xl border border-zinc-200 bg-white p-4">
    <div class="flex items-start gap-3">
      <div class="feed-shimmer h-10 w-10 shrink-0 rounded-full"></div>
      <div class="min-w-0 flex-1 space-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <div class="feed-shimmer h-4 w-28 rounded-full"></div>
          <div class="feed-shimmer h-4 w-36 rounded-full"></div>
        </div>
        <div class="feed-shimmer h-5 w-11/12 rounded-full"></div>
        <div class="space-y-2">
          <div class="feed-shimmer h-3 w-full rounded-full"></div>
          <div class="feed-shimmer h-3 w-5/6 rounded-full"></div>
          <div class="feed-shimmer h-3 w-3/4 rounded-full"></div>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <div class="feed-shimmer h-6 w-24 rounded-full"></div>
          <div class="feed-shimmer h-6 w-28 rounded-full"></div>
        </div>
      </div>
    </div>
    <div class="feed-shimmer mt-4 h-44 rounded-lg"></div>
  </div>
{/snippet}

{#snippet GazetteDeadlineCard({ deadline }: { deadline: GazetteDeadlineEvent })}
  <a
    href="https://linewaitersgazette.com/about/"
    target="_blank"
    rel="noopener noreferrer"
    class="block rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-400 hover:bg-zinc-50"
  >
    <div class="flex items-start gap-3">
      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xl">⏰</div>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-semibold text-zinc-900">Linewaiters' Gazette</span>
          <span class="shrink-0 text-sm text-zinc-400">{formatDate(new Date(`${deadline.dueDate}T12:00:00Z`))}</span>
        </div>
        <p class="mt-2 font-medium text-zinc-700">{deadline.title}</p>
        <p class="mt-1 text-sm text-zinc-500">
          {deadline.description}
        </p>
      </div>
    </div>
  </a>
{/snippet}

{#snippet GazetteCard({ article }: { article: GazetteArticle })}
  <a
    href={article.link}
    target="_blank"
    rel="noopener noreferrer"
    class="block rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-400 hover:bg-zinc-50"
  >
    <div class="flex items-start gap-3">
      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xl">📰</div>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-semibold text-zinc-900">Linewaiters' Gazette</span>
          <span class="shrink-0 text-sm text-zinc-400">{formatPublishedAt(new Date(article.pubDate))}</span>
        </div>
        <p class="mt-2 text-zinc-700">{article.title}</p>
        {#if article.image}
          <img
            src={article.image}
            alt={`${article.title} cover`}
            loading="lazy"
            decoding="async"
            class="mt-3 w-full rounded-lg"
          />
        {/if}
      </div>
    </div>
  </a>
{/snippet}

{#snippet FoodCoopCard({ article }: { article: FoodCoopAnnouncement })}
  <a
    href={article.link}
    target="_blank"
    rel="noopener noreferrer"
    class="block rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-400 hover:bg-zinc-50"
  >
    <div class="flex items-start gap-3">
      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-xl">📢</div>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-semibold text-zinc-900">Announcements</span>
          <span class="shrink-0 text-sm text-zinc-400">{formatPublishedAt(new Date(article.pubDate))}</span>
        </div>
        <p class="mt-2 font-medium text-zinc-700">{article.title}</p>
        {#if article.description}
          <p class="mt-1 line-clamp-3 text-sm text-zinc-500">{article.description}</p>
        {/if}
        {#if article.image}
          <img
            src={article.image}
            alt={`${article.title} cover`}
            loading="lazy"
            decoding="async"
            class="mt-3 w-full rounded-lg"
          />
        {/if}
      </div>
    </div>
  </a>
{/snippet}

{#snippet FoodCoopCooksCard({ article }: { article: FoodCoopCooksArticle })}
  <a
    href={article.link}
    target="_blank"
    rel="noopener noreferrer"
    class="block rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-400 hover:bg-zinc-50"
  >
    <div class="flex items-start gap-3">
      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xl">🧑‍🍳</div>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-semibold text-zinc-900">Cooking</span>
          <span class="shrink-0 text-sm text-zinc-400">{formatPublishedAt(new Date(article.pubDate))}</span>
        </div>
        <p class="mt-2 font-medium text-zinc-700">{article.title}</p>
        {#if article.description}
          <p class="mt-1 line-clamp-3 text-sm text-zinc-500">{article.description}</p>
        {/if}
        {#if article.image}
          <img
            src={article.image}
            alt={`${article.title} cover`}
            loading="lazy"
            decoding="async"
            class="mt-3 w-full rounded-lg"
          />
        {/if}
      </div>
    </div>
  </a>
{/snippet}

{#snippet EventbriteEventCard({
  event,
  label,
  emoji,
  titleOverride,
  datePrefix,
  highlightTitle = false,
}: {
  event: EventbriteEvent | FoodcoopEvent;
  label: string;
  emoji: string;
  titleOverride?: string;
  datePrefix?: string;
  highlightTitle?: boolean;
})}
  <a
    href={event.url}
    target="_blank"
    rel="noopener noreferrer"
    class="block rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-400 hover:bg-zinc-50"
  >
    <div class="flex items-start gap-3">
      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xl">{emoji}</div>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-semibold text-zinc-900">{label}</span>
          <span class="shrink-0 text-sm text-zinc-400">
            {datePrefix ? `${datePrefix} ${formatEventDateTime(event.startUtc, event.timezone)}` : formatEventDateTime(event.startUtc, event.timezone)}
          </span>
        </div>
        <p
          class={highlightTitle
            ? 'mt-2 inline rounded bg-amber-100 px-1 font-medium text-amber-900'
            : 'mt-2 font-medium text-zinc-700'}
        >
          {titleOverride ?? event.title}
        </p>
        {#if event.description}
          {@const displayDescription =
            label === 'General Meeting'
              ? formatGeneralMeetingDescriptionForNews(event.description)
              : event.description}
          <p
            class={label === 'General Meeting'
              ? 'mt-1 text-sm whitespace-pre-wrap text-zinc-500 [tab-size:4]'
              : 'mt-1 line-clamp-3 text-sm text-zinc-500'}
          >
            {displayDescription}
          </p>
        {/if}
        {#if event.venueName || event.venueAddress}
          <p class="mt-2 text-sm text-zinc-500">{[event.venueName, event.venueAddress].filter(Boolean).join(' • ')}</p>
        {/if}
        {#if event.image}
          <img
            src={event.image}
            alt={`Poster for ${event.title}`}
            loading="lazy"
            decoding="async"
            class="mt-3 w-full rounded-lg"
          />
        {/if}
      </div>
    </div>
  </a>
{/snippet}

{#snippet BlueskyCard({ post }: { post: FeedPost })}
  {@const isSelfRepost = post.repostedBy && post.repostedBy.handle === post.author.handle}
  <a
    href={getPostUrl(post.uri)}
    target="_blank"
    rel="noopener noreferrer"
    class="block rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-400 hover:bg-zinc-50"
  >
    {#if post.repostedBy}
      <div class="mb-3 flex items-center gap-1 text-sm text-zinc-500">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          ></path>
        </svg>
        <span>{isSelfRepost ? 'Reposted their own post' : `Reposted by ${post.repostedBy.displayName}`}</span>
      </div>
    {/if}

    {#if post.parent}
      <div class="mb-3 border-b border-zinc-200 pb-3">
        <div class="flex items-start gap-3">
          {#if post.parent.author.avatar}
            <img
              src={post.parent.author.avatar}
              alt={post.parent.author.displayName}
              loading="lazy"
              decoding="async"
              class="h-10 w-10 shrink-0 rounded-full"
            />
          {/if}
          <div class="min-w-0 flex-1">
            <div class="flex flex-col gap-0.5">
              <span class="text-sm font-medium text-zinc-600">{post.parent.author.displayName}</span>
              <span class="text-xs text-zinc-400">{formatPublishedAt(new Date(post.parent.createdAt))}</span>
            </div>
            <p class="mt-2 line-clamp-2 text-sm break-words whitespace-pre-wrap text-zinc-500">{post.parent.text}</p>
          </div>
        </div>
      </div>
    {/if}

    <div class="flex items-start gap-3">
      {#if post.author.avatar}
        <img
          src={post.author.avatar}
          alt={post.author.displayName}
          loading="lazy"
          decoding="async"
          class="h-10 w-10 shrink-0 rounded-full"
        />
      {/if}
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-1">
          <svg class="h-4 w-4 shrink-0 text-[#0085ff]" viewBox="0 0 600 530" fill="currentColor" aria-label="Bluesky">
            <title>Bluesky</title>
            <path d="m135.72 44.03c66.496 49.921 138.02 151.14 164.28 205.46 26.262-54.316 97.782-155.54 164.28-205.46 47.98-36.021 125.72-63.892 125.72 24.795 0 17.712-10.155 148.79-16.111 170.07-20.703 73.984-96.144 92.854-163.25 81.433 117.3 19.964 147.14 86.092 82.697 152.22-122.39 125.59-175.91-31.511-189.63-71.766-2.514-7.3797-6.0634-17.664-8.9824-26.262-2.9191 8.5976-6.4685 18.882-8.9824 26.262-13.723 40.255-67.243 197.36-189.63 71.766-64.444-66.128-34.605-132.26 82.697-152.22-67.108 11.421-142.55-7.4491-163.25-81.433-5.9562-21.282-16.111-152.36-16.111-170.07 0-88.687 77.742-60.816 125.72-24.795z"></path>
          </svg>
          <span class="truncate font-semibold text-zinc-900">{post.author.displayName}</span>
          <span class="shrink-0 text-sm text-zinc-400">{formatPublishedAt(new Date(post.createdAt))}</span>
        </div>

        <p class="mt-2 break-words whitespace-pre-wrap text-zinc-700">{post.text}</p>

        {#if post.images && post.images.length > 0}
          <div class="mt-3 grid grid-cols-2 gap-2">
            {#each post.images as img, idx (`${img.thumb}-${idx}`)}
              <img
                src={img.thumb}
                alt={img.alt || 'Post media'}
                loading="lazy"
                decoding="async"
                class="w-full rounded-lg"
              />
            {/each}
          </div>
        {/if}

        {#if post.quotedPost}
          <div class="mt-3 rounded-lg border border-zinc-200 p-3">
            <div class="flex flex-wrap items-center gap-2">
              {#if post.quotedPost.author.avatar}
                <img
                  src={post.quotedPost.author.avatar}
                  alt={post.quotedPost.author.displayName}
                  loading="lazy"
                  decoding="async"
                  class="h-5 w-5 rounded-full"
                />
              {/if}
              <span class="text-sm font-medium text-zinc-700">{post.quotedPost.author.displayName}</span>
              <span class="text-xs text-zinc-400">{formatPublishedAt(new Date(post.quotedPost.createdAt))}</span>
            </div>
            {#if post.quotedPost.text}
              <p class="mt-2 text-sm break-words whitespace-pre-wrap text-zinc-600">{post.quotedPost.text}</p>
            {/if}
            {#if post.quotedPost.images && post.quotedPost.images.length > 0}
              <div class="mt-2 grid grid-cols-2 gap-2">
                {#each post.quotedPost.images as img, idx (`${img.thumb}-${idx}`)}
                  <img
                    src={img.thumb}
                    alt={img.alt || 'Quoted post media'}
                    loading="lazy"
                    decoding="async"
                    class="w-full rounded-lg"
                  />
                {/each}
              </div>
            {/if}
          </div>
        {/if}

      </div>
    </div>
  </a>
{/snippet}

{#snippet ProduceCard({ update, date, favorites }: { update: ProduceEvent; date: Date; favorites: Set<string> })}
  <a
    href={`/produce?date=${update.id}`}
    class="block rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-400 hover:bg-zinc-50"
  >
    <div class="flex items-start gap-3">
      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-xl">🥬</div>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-semibold text-zinc-900">Produce</span>
          <span class="shrink-0 text-sm text-zinc-400">{formatPublishedAt(date)}</span>
        </div>

        <p class="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-zinc-500">
          {#if update.newArrivals.length > 0}
            <span class="inline-flex items-center rounded-full bg-[rgb(255,246,220)] px-2.5 py-1 text-xs font-medium text-[#3F7540]">
              {update.newArrivals.length} new arrival{update.newArrivals.length !== 1 ? 's' : ''}
            </span>
          {/if}
          {#if update.newArrivals.length > 0 && update.outOfStock.length > 0}
            <span class="text-zinc-400">·</span>
          {/if}
          {#if update.outOfStock.length > 0}
            <span class="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
              {update.outOfStock.length} out of stock
            </span>
          {/if}
        </p>

        {#if update.newArrivals.length > 0}
          <div class="mt-3">
            <div class="flex flex-wrap gap-1.5">
              {#each update.newArrivals as item (item.name)}
                <span class="inline-flex items-center gap-1 rounded-full bg-[rgb(255,246,220)] px-2 py-0.5 text-xs text-[#3F7540]">
                  {#if favorites.has(item.name)}
                    <span class="text-[12px] leading-none text-amber-700">♥</span>
                  {/if}
                  <span class={favorites.has(item.name) ? 'font-bold' : ''}>{item.name}</span>
                </span>
              {/each}
            </div>
          </div>
        {/if}

        {#if update.outOfStock.length > 0}
          <div class="mt-3">
            <div class="flex flex-wrap gap-1.5">
              {#each update.outOfStock as item (item.name)}
                <span class="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                  {#if favorites.has(item.name)}
                    <span class="text-[12px] leading-none text-amber-700">♥</span>
                  {/if}
                  <span class={favorites.has(item.name) ? 'font-bold' : ''}>{item.name}</span>
                </span>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  </a>
{/snippet}
