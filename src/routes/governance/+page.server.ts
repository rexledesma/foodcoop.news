import {
  governanceApiPayloadSchema,
  type GovernanceApiPayload,
  gmEventsApiPayloadSchema,
  type GovernancePendingAgendaItem,
  type GovernancePreviousAgendaItem,
} from '@/lib/governance';

const DEFAULT_GM_AGENDA_URL = 'https://www.foodcoop.com/gmagenda/';
const FALLBACK_SOURCE_URL =
  'https://www.foodcoop.com/wp-content/uploads/2026/02/2026_02_03_agenda_committee.pdf';

type GovernancePagePayload = {
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

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function parseCurrentAgendaItemsFromDescription(description: string | undefined): string[] {
  if (!description) {
    return [];
  }

  const lines = description
    .split(/\r?\n/)
    .map((line): string => collapseWhitespace(line))
    .filter(Boolean);

  const agendaStartIndex = lines.findIndex((line): boolean => /^V\.\s*Agenda\b/i.test(line));
  if (agendaStartIndex < 0) {
    return [];
  }

  const agendaSectionLines: string[] = [];
  for (let i = agendaStartIndex; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (i > agendaStartIndex && /^[IVXLCDM]+\.\s+/i.test(line)) {
      break;
    }
    agendaSectionLines.push(line);
  }

  const agendaSectionText = collapseWhitespace(
    agendaSectionLines.join(' ').replace(/^V\.\s*Agenda\b\s*[:\-–—]?\s*/i, ''),
  );

  const bodyLines = agendaSectionLines
    .slice(1)
    .map((line): string => collapseWhitespace(line))
    .filter(Boolean);
  const groupedItems: string[] = [];
  let currentItemParts: string[] = [];

  for (const line of bodyLines) {
    if (/^Item\s+\d+:/i.test(line)) {
      if (currentItemParts.length > 0) {
        groupedItems.push(currentItemParts.join('\n'));
      }
      currentItemParts = [line];
      continue;
    }

    if (currentItemParts.length > 0) {
      currentItemParts.push(line);
    }
  }

  if (currentItemParts.length > 0) {
    groupedItems.push(currentItemParts.join('\n'));
  }

  if (groupedItems.length > 0) {
    return groupedItems;
  }

  const agendaItemsText = collapseWhitespace(agendaSectionText);
  if (!agendaItemsText) {
    return [];
  }

  const itemLabelMatches = Array.from(
    agendaItemsText.matchAll(/Item\s+\d+:\s*.*?(?=(?:\s+Item\s+\d+:)|$)/gi),
  )
    .map((match): string => collapseWhitespace(match[0] ?? ''))
    .filter(Boolean);
  if (itemLabelMatches.length > 0) {
    return itemLabelMatches;
  }

  const segmentedItems = agendaItemsText
    .split(/\s*[;•|]\s*/g)
    .map((item): string => collapseWhitespace(item))
    .filter(Boolean);

  return segmentedItems.length > 1 ? segmentedItems : [agendaItemsText];
}

async function loadGovernancePayload(
  fetch: typeof globalThis.fetch,
): Promise<GovernancePagePayload> {
  let currentItems: string[] = [];
  let currentAgendaUrl = DEFAULT_GM_AGENDA_URL;
  let currentMeetingStartUtc: string | null = null;
  let currentMeetingTimezone: string | null = null;

  try {
    const gmEventsResponse = await fetch('/api/foodcoop/gm-events');
    const rawGmEventsPayload = (await gmEventsResponse.json()) as unknown;
    const parsedGmEventsPayload = gmEventsApiPayloadSchema.safeParse(rawGmEventsPayload);
    const gmEvent = parsedGmEventsPayload.success
      ? (parsedGmEventsPayload.data.events[0] ?? null)
      : null;

    currentItems = parseCurrentAgendaItemsFromDescription(gmEvent?.description);
    currentAgendaUrl = gmEvent?.url || DEFAULT_GM_AGENDA_URL;
    currentMeetingStartUtc = gmEvent?.startUtc ?? null;
    currentMeetingTimezone = gmEvent?.timezone ?? null;
  } catch {
    currentItems = [];
    currentAgendaUrl = DEFAULT_GM_AGENDA_URL;
    currentMeetingStartUtc = null;
    currentMeetingTimezone = null;
  }

  try {
    const response = await fetch('/api/governance/pending-agenda-items');
    const rawPayload = (await response.json()) as unknown;
    const parsedPayload = governanceApiPayloadSchema.safeParse(rawPayload);
    const payload: GovernanceApiPayload | null = parsedPayload.success ? parsedPayload.data : null;

    return {
      sourceUrl: payload?.sourceUrl ?? FALLBACK_SOURCE_URL,
      lastUpdated: payload?.lastUpdated ?? null,
      items: payload?.items ?? [],
      previousItems: payload?.previousItems ?? [],
      currentItems,
      currentAgendaUrl,
      currentMeetingStartUtc,
      currentMeetingTimezone,
      error: response.ok ? null : (payload?.error ?? 'Unable to load pending agenda items.'),
    };
  } catch {
    return {
      sourceUrl: FALLBACK_SOURCE_URL,
      lastUpdated: null,
      items: [],
      previousItems: [],
      currentItems,
      currentAgendaUrl,
      currentMeetingStartUtc,
      currentMeetingTimezone,
      error: 'Unable to load pending agenda items.',
    };
  }
}

export async function load({ fetch }: { fetch: typeof globalThis.fetch }): Promise<{
  governanceData: GovernancePagePayload;
}> {
  const governanceData = await loadGovernancePayload(fetch);

  return {
    governanceData,
  };
}
