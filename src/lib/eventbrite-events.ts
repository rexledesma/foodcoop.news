import type { EventbriteEvent } from '@/lib/types';

interface EventbriteVenueAddress {
  address_1?: string;
  address_2?: string;
  city?: string;
  region?: string;
  postal_code?: string;
}

interface EventbriteVenue {
  name?: string;
  address?: EventbriteVenueAddress;
}

interface EventbriteApiEvent {
  id: string;
  name?: { text?: string };
  description?: { text?: string };
  url: string;
  start: { utc: string; timezone: string };
  logo?: { url?: string };
  venue?: EventbriteVenue;
}

type FetchEventbriteEventsByIdOptions = {
  organizerPageUrl: string;
  apiKey: string;
  titleFallback: string;
  namePattern?: RegExp;
  maxEventIds?: number;
};

const EVENT_WINDOW_DAYS = 45;
const EVENT_ID_PATTERN = /tickets-(\d+)/g;

function formatVenueAddress(address?: EventbriteVenueAddress): string | undefined {
  if (!address) return undefined;

  const parts = [
    address.address_1,
    address.address_2,
    address.city,
    address.region,
    address.postal_code,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : undefined;
}

function inWindow(startUtc: string): boolean {
  const eventTime = new Date(startUtc).getTime();
  if (Number.isNaN(eventTime)) return false;

  const now = Date.now();
  const fortyFiveDaysAgo = now - EVENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const fortyFiveDaysAhead = now + EVENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return eventTime >= fortyFiveDaysAgo && eventTime <= fortyFiveDaysAhead;
}

async function fetchEventIdsFromOrganizerPage(
  organizerPageUrl: string,
  maxEventIds: number,
): Promise<string[]> {
  const response = await fetch(organizerPageUrl, {
    headers: {
      'user-agent': 'foodcoop.news event sync',
    },
  });

  if (!response.ok) return [];

  const html = await response.text();
  const matches = Array.from(html.matchAll(EVENT_ID_PATTERN), (match) => match[1]);
  return Array.from(new Set(matches)).slice(0, maxEventIds);
}

async function fetchEventById(id: string, apiKey: string): Promise<EventbriteApiEvent | null> {
  const response = await fetch(`https://www.eventbriteapi.com/v3/events/${id}/?expand=logo,venue`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) return null;
  return (await response.json()) as EventbriteApiEvent;
}

function mapEvent(event: EventbriteApiEvent, titleFallback: string): EventbriteEvent {
  return {
    id: event.id,
    title: event.name?.text || titleFallback,
    description: event.description?.text || undefined,
    url: event.url,
    startUtc: event.start.utc,
    timezone: event.start.timezone,
    venueName: event.venue?.name || undefined,
    venueAddress: formatVenueAddress(event.venue?.address),
    image: event.logo?.url || undefined,
  };
}

export async function fetchEventbriteEventsById(
  options: FetchEventbriteEventsByIdOptions,
): Promise<EventbriteEvent[]> {
  const ids = await fetchEventIdsFromOrganizerPage(
    options.organizerPageUrl,
    options.maxEventIds ?? 50,
  );
  if (ids.length === 0) return [];

  const events = await Promise.all(ids.map((id) => fetchEventById(id, options.apiKey)));

  return events
    .filter((event): event is EventbriteApiEvent => Boolean(event))
    .filter((event) => inWindow(event.start.utc))
    .filter((event) => {
      if (!options.namePattern) return true;
      return options.namePattern.test(event.name?.text || '');
    })
    .map((event) => mapEvent(event, options.titleFallback))
    .sort((a, b) => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime());
}
