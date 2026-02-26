import { fetchEventbriteEventsById } from '@/lib/eventbrite-events';
import type { EventbriteEvent } from '@/lib/types';

const EVENTBRITE_ORGANIZER_PAGE_URL =
  'https://www.eventbrite.com/o/park-slope-food-coop-cooking-classes-106518851821';

// Cache event data for 5 minutes
let cachedEvents: EventbriteEvent[] | null = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000;

async function fetchFoodCoopCooksEvents(): Promise<EventbriteEvent[]> {
  const apiKey = process.env.EVENTBRITE_API_KEY;
  if (!apiKey) {
    throw new Error('Missing EVENTBRITE_API_KEY');
  }

  return fetchEventbriteEventsById({
    organizerPageUrl: EVENTBRITE_ORGANIZER_PAGE_URL,
    apiKey,
    titleFallback: 'Food Coop Cooks Event',
  });
}

export async function GET() {
  try {
    const now = Date.now();
    if (!cachedEvents || now - cacheTime > CACHE_DURATION) {
      cachedEvents = await fetchFoodCoopCooksEvents();
      cacheTime = now;
    }

    return Response.json({
      events: cachedEvents,
      total: cachedEvents.length,
      lastUpdated: new Date(cacheTime).toISOString(),
    });
  } catch (error) {
    console.error('Food Coop Cooks Eventbrite API error:', error);
    return Response.json({ error: 'Failed to fetch Food Coop Cooks events' }, { status: 500 });
  }
}
