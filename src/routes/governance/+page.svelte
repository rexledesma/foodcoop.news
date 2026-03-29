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

  type PreviousAgendaGroup = {
    dateTimeKey: string;
    url: string;
    subjects: string[];
  };

  function buildPreviousAgendaGroups(items: GovernancePreviousAgendaItem[]): PreviousAgendaGroup[] {
    const grouped = new Map<string, PreviousAgendaGroup>();

    for (const item of items) {
      const key = `${item.meetingDate}|${item.url}`;
      const group = grouped.get(key);
      if (!group) {
        grouped.set(key, {
          dateTimeKey: item.meetingDate,
          url: item.url,
          subjects: [item.subject],
        });
        continue;
      }
      group.subjects.push(item.subject);
    }

    return [...grouped.values()]
      .map((group): PreviousAgendaGroup => ({
        ...group,
        subjects: [...group.subjects].sort((a, b): number => a.localeCompare(b)),
      }))
      .sort((a, b): number => (a.dateTimeKey < b.dateTimeKey ? 1 : -1));
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
  const previousAgendaGroups = $derived(buildPreviousAgendaGroups(governance.previousItems));
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
                <span class="font-semibold text-zinc-900">Upcoming General Meeting Agenda</span>
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

    {#if previousAgendaGroups.length > 0}
      <section class="mb-6 space-y-3">
        {#each previousAgendaGroups as group}
          <a
            href={group.url}
            target="_blank"
            rel="noopener noreferrer"
            class="block rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-400 hover:bg-zinc-50"
          >
            <div class="flex items-start gap-3">
              <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xl">
                ⏮️
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-semibold text-zinc-900">General Meeting Agenda</span>
                  <span class="shrink-0 text-sm text-zinc-400">
                    {formatPreviousAgendaDateTime(group.dateTimeKey)}
                  </span>
                </div>
                <ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700 marker:text-zinc-400">
                  {#each group.subjects as subject}
                    <li><span class="font-semibold text-zinc-900">{subject}</span></li>
                  {/each}
                </ul>
              </div>
            </div>
          </a>
        {/each}
      </section>
    {/if}
</div>
