<script lang="ts">
  import type { GovernancePendingAgendaItem, GovernancePreviousAgendaItem } from '@/lib/governance';

  let {
    data,
  }: {
    data: {
      governanceData: {
        sourceUrl: string;
        lastUpdated: string | null;
        items: GovernancePendingAgendaItem[];
        previousItems: GovernancePreviousAgendaItem[];
        currentItems: string[];
        currentAgendaUrl: string;
        currentMeetingStartUtc: string | null;
        currentMeetingTimezone: string | null;
        error: string | null;
      };
    };
  } = $props();
  const governance = $derived(data.governanceData);

  function formatEventDateTime(value: string | null, timezone: string | null): string {
    if (!value || !timezone) {
      return 'Date unavailable';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Date unavailable';
    }
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
    });
  }

  function isFutureDate(value: string | null): boolean {
    if (!value) {
      return false;
    }
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date > new Date();
  }

  function currentAgendaTitle(startUtc: string | null): string {
    return isFutureDate(startUtc) ? 'Upcoming General Meeting Agenda' : 'General Meeting Agenda';
  }

  function splitCurrentItem(item: string): { title: string; details: string[] } {
    const lines = item
      .split(/\r?\n/)
      .map((line): string => line.trim())
      .filter(Boolean);

    return {
      title: lines[0] ?? item,
      details: lines.slice(1),
    };
  }

  function formatPreviousAgendaDateTime(dateKey: string): string {
    const [yearText, monthText, dayText] = dateKey.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      !Number.isInteger(day) ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31
    ) {
      return 'Date unavailable';
    }

    const date = new Date(Date.UTC(year, month - 1, day));
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

  function formatPreviousMeetingTitle(dateKey: string): string {
    const [yearText, monthText, dayText] = dateKey.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      !Number.isInteger(day) ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31
    ) {
      return 'General Meeting';
    }

    const date = new Date(Date.UTC(year, month - 1, day));
    const meetingMonth = date.toLocaleDateString('en-US', {
      month: 'long',
      timeZone: 'UTC',
    });
    return `${meetingMonth} General Meeting`;
  }

  function openExternal(url: string): void {
    if (!url) {
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function handleCardKeydown(event: KeyboardEvent, url: string): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openExternal(url);
    }
  }

  function previousMeetingDisplayTitle(item: GovernancePreviousAgendaItem): string {
    return item.gazetteTitle || formatPreviousMeetingTitle(item.meetingDate);
  }
</script>

<div class="mx-auto w-full max-w-3xl px-4 pb-16">
  <div class="py-6">
    <h1 class="text-2xl font-bold text-zinc-900">Governance</h1>
  </div>

  {#if governance.error}
      <div class="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
        {governance.error}
      </div>
    {/if}

    {#if governance.currentItems.length > 0}
      <section class="mb-6">
        <a
          href={governance.currentAgendaUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="block rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-400 hover:bg-zinc-50"
        >
          <div class="flex items-start gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xl">
              🗳️
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-semibold text-zinc-900">{currentAgendaTitle(governance.currentMeetingStartUtc)}</span>
                <span class="shrink-0 text-sm text-zinc-400">
                  {formatEventDateTime(governance.currentMeetingStartUtc, governance.currentMeetingTimezone)}
                </span>
              </div>
              <ul class="mt-2 list-disc space-y-3 pl-5 text-sm text-zinc-900 marker:text-zinc-400">
                {#each governance.currentItems as item}
                  {@const parts = splitCurrentItem(item)}
                  <li>
                    <p class="font-semibold">{parts.title}</p>
                    {#if parts.details.length > 0}
                      <div class="mt-1 space-y-1 text-xs text-zinc-700">
                        {#each parts.details as detail}
                          <p>{detail}</p>
                        {/each}
                      </div>
                    {/if}
                  </li>
                {/each}
              </ul>
            </div>
          </div>
        </a>
      </section>
    {/if}

    <section class="mb-6">
    {#if governance.items.length === 0}
      <div class="rounded-xl border border-zinc-200 bg-white px-4 py-6 text-sm text-zinc-500">
        No pending agenda items found.
      </div>
    {:else}
      <a
        href={governance.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="block rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-400 hover:bg-zinc-50"
      >
        <div class="flex items-start gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xl">
            🔜
          </div>
          <div class="min-w-0 flex-1">
            <p class="font-semibold text-zinc-900">Pending Agenda Items</p>
            <ul class="mt-2 list-disc space-y-2 pl-5 text-sm text-zinc-700 marker:text-zinc-400">
              {#each governance.items as item}
                <li>
                  <p class="font-semibold text-zinc-900">{item.agendaItemNumber} · {item.subject}</p>
                  <p class="mt-0.5 text-xs text-zinc-500">{item.submittedRevisionDate || 'Unavailable'}</p>
                </li>
              {/each}
            </ul>
          </div>
        </div>
      </a>
    {/if}
    </section>

    {#if governance.previousItems.length > 0}
      <section class="mb-6 space-y-3">
        {#each governance.previousItems as item}
          <div
            role="link"
            tabindex="0"
            onclick={(): void => openExternal(item.gazetteUrl || item.minutesUrl)}
            onkeydown={(event): void => handleCardKeydown(event, item.gazetteUrl || item.minutesUrl)}
            class="block cursor-pointer rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-400 hover:bg-zinc-50"
          >
            <div class="flex items-start gap-3">
              <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xl">
                📰
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <a
                    href={item.minutesUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onclick={(event): void => event.stopPropagation()}
                    onkeydown={(event): void => event.stopPropagation()}
                    class="font-semibold text-zinc-900 underline-offset-2 hover:underline focus-visible:underline"
                  >
                    General Meeting
                  </a>
                  <span class="shrink-0 text-sm text-zinc-400">
                    {formatPreviousAgendaDateTime(item.meetingDate)}
                  </span>
                </div>
                <div class="mt-2">
                  <a
                    href={item.minutesUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onclick={(event): void => event.stopPropagation()}
                    onkeydown={(event): void => event.stopPropagation()}
                    class="text-zinc-700"
                  >
                    {previousMeetingDisplayTitle(item)}
                  </a>
                </div>
                {#if item.agendaSubjects.length > 0}
                  <ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700 marker:text-zinc-400">
                    {#each item.agendaSubjects as subject}
                      <li><span class="font-semibold text-zinc-900">{subject}</span></li>
                    {/each}
                  </ul>
                {/if}
                {#if item.gazettePreviewImageUrl}
                  <img
                    src={item.gazettePreviewImageUrl}
                    alt={`${previousMeetingDisplayTitle(item)} cover`}
                    loading="lazy"
                    decoding="async"
                    class="mt-3 w-full rounded-lg"
                  />
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </section>
    {/if}
</div>
