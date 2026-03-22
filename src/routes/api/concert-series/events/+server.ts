import { EVENTBRITE_API_KEY } from '$env/static/private';

import { fetchEventbriteEventsById } from '@/lib/eventbrite-events';
import type { EventbriteEvent } from '@/lib/types';

const EVENTBRITE_ORGANIZER_PAGE_URL =
  'https://www.eventbrite.com/o/park-slope-food-coop-concert-series-111655166091';

// Cache event data for 5 minutes
let cachedEvents: EventbriteEvent[] | null = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000;

async function fetchConcertSeriesEvents(): Promise<EventbriteEvent[]> {
  const apiKey = EVENTBRITE_API_KEY;
  if (!apiKey) {
    throw new Error('Missing EVENTBRITE_API_KEY');
  }

  return fetchEventbriteEventsById({
    organizerPageUrl: EVENTBRITE_ORGANIZER_PAGE_URL,
    apiKey,
    titleFallback: 'Concert Series Event',
  });
}

export async function GET() {
  try {
    const now = Date.now();
    if (!cachedEvents || now - cacheTime > CACHE_DURATION) {
      cachedEvents = await fetchConcertSeriesEvents();
      cacheTime = now;
    }

    return Response.json({
      events: cachedEvents,
      total: cachedEvents.length,
      lastUpdated: new Date(cacheTime).toISOString(),
    });
  } catch (error) {
    console.error('Concert Series Eventbrite API error:', error);
    return Response.json({ error: 'Failed to fetch Concert Series events' }, { status: 500 });
  }
}
