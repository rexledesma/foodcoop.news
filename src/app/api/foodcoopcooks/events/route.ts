import { NextResponse } from "next/server";
import type { FoodCoopCooksEvent } from "@/lib/types";

const EVENTBRITE_ORGANIZER_ID = "106518851821";
const EVENTBRITE_API_URL = `https://www.eventbriteapi.com/v3/organizers/${EVENTBRITE_ORGANIZER_ID}/events/`;

// Cache event data for 5 minutes
let cachedEvents: FoodCoopCooksEvent[] | null = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000;

interface EventbriteVenueAddress {
  address_1?: string;
  address_2?: string;
  city?: string;
  region?: string;
  postal_code?: string;
  country?: string;
}

interface EventbriteVenue {
  name?: string;
  address?: EventbriteVenueAddress;
}

interface EventbriteEvent {
  id: string;
  name?: { text?: string };
  description?: { text?: string };
  url: string;
  start: { utc: string; timezone: string };
  logo?: { url?: string };
  venue?: EventbriteVenue;
}

interface EventbriteResponse {
  events: EventbriteEvent[];
}

function formatVenueAddress(address?: EventbriteVenueAddress): string | undefined {
  if (!address) return undefined;
  const parts = [
    address.address_1,
    address.address_2,
    address.city,
    address.region,
    address.postal_code,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : undefined;
}

async function fetchFoodCoopCooksEvents(): Promise<FoodCoopCooksEvent[]> {
  const apiKey = process.env.EVENTBRITE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing EVENTBRITE_API_KEY");
  }

  const url = new URL(EVENTBRITE_API_URL);
  url.searchParams.set("status", "live");
  url.searchParams.set("order_by", "start_asc");
  url.searchParams.set("expand", "logo,venue");

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Eventbrite API error: ${response.status}`);
  }

  const data: EventbriteResponse = await response.json();
  const now = Date.now();

  return (data.events || [])
    .filter((event) => new Date(event.start.utc).getTime() >= now)
    .map((event) => ({
      id: event.id,
      title: event.name?.text || "Food Coop Cooks Event",
      description: event.description?.text || undefined,
      url: event.url,
      startUtc: event.start.utc,
      timezone: event.start.timezone,
      venueName: event.venue?.name || undefined,
      venueAddress: formatVenueAddress(event.venue?.address),
      image: event.logo?.url || undefined,
    }));
}

export async function GET() {
  try {
    const now = Date.now();
    if (!cachedEvents || now - cacheTime > CACHE_DURATION) {
      cachedEvents = await fetchFoodCoopCooksEvents();
      cacheTime = now;
    }

    return NextResponse.json({
      events: cachedEvents,
      total: cachedEvents.length,
      lastUpdated: new Date(cacheTime).toISOString(),
    });
  } catch (error) {
    console.error("Food Coop Cooks Eventbrite API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch Food Coop Cooks events" },
      { status: 500 }
    );
  }
}
