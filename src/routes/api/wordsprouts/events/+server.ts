import { EVENTBRITE_API_KEY } from '$env/static/private';

import { fetchEventbriteEventsById } from '@/lib/eventbrite-events';
import type { EventbriteEvent } from '@/lib/types';

const EVENTBRITE_ORGANIZER_PAGE_URL =
  'https://www.eventbrite.com/o/park-slope-food-coop-wordsprouts-31080353121';
const WORDSPROUTS_QUERY = /wordsprouts/i;

// Cache event data for 5 minutes
let cachedEvents: EventbriteEvent[] | null = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000;

async function fetchWordsproutsEvents(): Promise<EventbriteEvent[]> {
  const apiKey = EVENTBRITE_API_KEY;
  if (!apiKey) {
    throw new Error('Missing EVENTBRITE_API_KEY');
  }

  return fetchEventbriteEventsById({
    organizerPageUrl: EVENTBRITE_ORGANIZER_PAGE_URL,
    apiKey,
    titleFallback: 'Wordsprouts Event',
    namePattern: WORDSPROUTS_QUERY,
  });
}

export async function GET() {
  try {
    const now = Date.now();
    if (!cachedEvents || now - cacheTime > CACHE_DURATION) {
      cachedEvents = await fetchWordsproutsEvents();
      cacheTime = now;
    }

    return Response.json({
      events: cachedEvents,
      total: cachedEvents.length,
      lastUpdated: new Date(cacheTime).toISOString(),
    });
  } catch (error) {
    console.error('Wordsprouts Eventbrite API error:', error);
    return Response.json({ error: 'Failed to fetch Wordsprouts events' }, { status: 500 });
  }
}
