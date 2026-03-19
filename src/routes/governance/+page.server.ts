import {
  governanceApiPayloadSchema,
  type GovernanceApiPayload,
  type GovernancePendingAgendaItem,
} from '@/lib/governance';

export async function load({ fetch }: { fetch: typeof globalThis.fetch }): Promise<{
  sourceUrl: string;
  lastUpdated: string | null;
  items: GovernancePendingAgendaItem[];
  error: string | null;
}> {
  const fallbackSourceUrl =
    'https://www.foodcoop.com/wp-content/uploads/2026/02/2026_02_03_agenda_committee.pdf';

  try {
    const response = await fetch('/api/governance/pending-agenda-items');
    const rawPayload = (await response.json()) as unknown;
    const parsedPayload = governanceApiPayloadSchema.safeParse(rawPayload);
    const payload: GovernanceApiPayload | null = parsedPayload.success ? parsedPayload.data : null;

    return {
      sourceUrl: payload?.sourceUrl ?? fallbackSourceUrl,
      lastUpdated: payload?.lastUpdated ?? null,
      items: payload?.items ?? [],
      error: response.ok ? null : (payload?.error ?? 'Unable to load pending agenda items.'),
    };
  } catch {
    return {
      sourceUrl: fallbackSourceUrl,
      lastUpdated: null,
      items: [],
      error: 'Unable to load pending agenda items.',
    };
  }
}
