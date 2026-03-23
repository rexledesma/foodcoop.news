<script lang="ts">
  import type { GovernancePendingAgendaItem } from '@/lib/governance';

  let {
    data,
  }: {
    data: {
      sourceUrl: string;
      lastUpdated: string | null;
      items: GovernancePendingAgendaItem[];
      currentItems: string[];
      currentAgendaUrl: string;
      currentMeetingStartUtc: string | null;
      currentMeetingTimezone: string | null;
      error: string | null;
    };
  } = $props();

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
</script>

<div class="mx-auto w-full max-w-3xl px-4 pb-16">
  <div class="py-6">
    <h1 class="text-2xl font-bold text-zinc-900">Governance</h1>
  </div>

  {#if data.error}
    <div class="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
      {data.error}
    </div>
  {/if}

  {#if data.currentItems.length > 0}
    <section class="mb-6">
      <a
        href={data.currentAgendaUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="block rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-400"
      >
        <div class="flex items-start gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xl">🗳️</div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-semibold text-zinc-900">Upcoming Agenda</span>
              <span class="shrink-0 text-sm text-zinc-400">
                {formatEventDateTime(data.currentMeetingStartUtc, data.currentMeetingTimezone)}
              </span>
            </div>
            <ul class="mt-2 list-disc space-y-3 pl-5 text-sm text-zinc-900 marker:text-zinc-400">
              {#each data.currentItems as item}
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

  <section>
  {#if data.items.length === 0}
    <div class="rounded-xl border border-zinc-200 bg-white px-4 py-6 text-sm text-zinc-500">
      No pending agenda items found.
    </div>
  {:else}
    <a
      href={data.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      class="block rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-400"
    >
      <div class="flex items-start gap-3">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xl">🔜</div>
        <div class="min-w-0 flex-1">
          <p class="font-semibold text-zinc-900">Pending Agenda Items</p>
          <ul class="mt-2 list-disc space-y-2 pl-5 text-sm text-zinc-700 marker:text-zinc-400">
            {#each data.items as item}
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
</div>
