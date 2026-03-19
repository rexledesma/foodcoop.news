<script lang="ts">
  import type { GovernancePendingAgendaItem } from '@/lib/governance';

  let {
    data,
  }: {
    data: {
      sourceUrl: string;
      lastUpdated: string | null;
      items: GovernancePendingAgendaItem[];
      error: string | null;
    };
  } = $props();

  function formatTimestamp(value: string | null): string {
    if (!value) {
      return 'Unavailable';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Unavailable';
    }
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
</script>

<div class="mx-auto w-full max-w-3xl px-4 pb-16">
  <div class="py-6">
    <h1 class="text-2xl font-bold text-zinc-900">Governance</h1>
    <p class="mt-1 text-sm text-zinc-600">
      Pending agenda items provided by the Park Slope Food Coop Agenda Committee.
    </p>
    <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-zinc-500">
      <span>Last updated: {formatTimestamp(data.lastUpdated)}</span>
      <a
        href={data.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-black"
      >
        View source PDF
      </a>
    </div>
  </div>

  {#if data.error}
    <div class="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
      {data.error}
    </div>
  {/if}

  {#if data.items.length === 0}
    <div class="rounded-xl border border-zinc-200 bg-white px-4 py-6 text-sm text-zinc-500">
      No pending agenda items found.
    </div>
  {:else}
    <div class="space-y-4">
      {#each data.items as item}
        <article class="rounded-xl border border-zinc-200 bg-white p-4">
          <dl class="space-y-3">
            <div>
              <dt class="text-xs font-semibold tracking-[0.08em] text-zinc-500 uppercase">Agenda Item Number</dt>
              <dd class="mt-1 text-sm text-zinc-900">{item.agendaItemNumber}</dd>
            </div>
            <div>
              <dt class="text-xs font-semibold tracking-[0.08em] text-zinc-500 uppercase">Submitted/Revision Date</dt>
              <dd class="mt-1 text-sm text-zinc-900">{item.submittedRevisionDate || 'Unavailable'}</dd>
            </div>
            <div>
              <dt class="text-xs font-semibold tracking-[0.08em] text-zinc-500 uppercase">Subject</dt>
              <dd class="mt-1 text-sm text-zinc-900">{item.subject}</dd>
            </div>
            <div>
              <dt class="text-xs font-semibold tracking-[0.08em] text-zinc-500 uppercase">Discussion</dt>
              <dd class="mt-1 text-sm text-zinc-900">{item.discussion || '—'}</dd>
            </div>
          </dl>
        </article>
      {/each}
    </div>
  {/if}
</div>
