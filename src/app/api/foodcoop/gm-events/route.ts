import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import type { FoodcoopEvent } from "@/lib/types";

const GM_SOURCE_URL = "https://www.foodcoop.com/";
const GM_AGENDA_URL = "https://www.foodcoop.com/gmagenda/";
const TIMEZONE = "America/New_York";

// Cache event data for 5 minutes
let cachedEvents: FoodcoopEvent[] | null = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000;

function parseGMDateTime(text: string): Date | null {
  // Match patterns like:
  // "Tuesday, January 27, 2026 7:00 p.m."
  // "January 27, 2026, 7:00 pm"
  // "Tue. Feb. 24th 2026 7:00 pm"
  const dateMatch = text.match(
    /(?:\b(?:Mon|Tue|Tues|Wed|Thu|Thur|Fri|Sat|Sun)\.?|\w+day)?,?\s*(\w+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\s*(\d{1,2}):(\d{2})\s*(p\.?m\.?|a\.?m\.?)/i
  );

  if (!dateMatch) return null;

  const [, monthStr, dayStr, yearStr, hourStr, minuteStr, ampm] = dateMatch;
  const months: Record<string, number> = {
    january: 0,
    jan: 0,
    february: 1,
    feb: 1,
    march: 2,
    mar: 2,
    april: 3,
    apr: 3,
    may: 4,
    june: 5,
    jun: 5,
    july: 6,
    jul: 6,
    august: 7,
    aug: 7,
    september: 8,
    sept: 8,
    sep: 8,
    october: 9,
    oct: 9,
    november: 10,
    nov: 10,
    december: 11,
    dec: 11,
  };

  const monthKey = monthStr.toLowerCase().replace(".", "");
  const month = months[monthKey];
  if (month === undefined) return null;

  let hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  const day = parseInt(dayStr, 10);
  const year = parseInt(yearStr, 10);

  // Convert to 24-hour format
  const isPM = ampm.toLowerCase().startsWith("p");
  if (isPM && hour !== 12) hour += 12;
  if (!isPM && hour === 12) hour = 0;

  // Get the UTC offset for America/New_York on this specific date
  // This ensures correct handling regardless of server timezone (UTC on Cloudflare, local on dev)
  const refDate = new Date(Date.UTC(year, month, day, 12, 0, 0));
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    timeZoneName: "shortOffset",
  });
  const parts = formatter.formatToParts(refDate);
  const tzPart = parts.find((p) => p.type === "timeZoneName");
  // tzPart.value will be like "GMT-5" or "GMT-4"
  const offsetMatch = tzPart?.value.match(/GMT([+-]\d+)/);
  const offsetHours = offsetMatch ? parseInt(offsetMatch[1], 10) : -5;

  // Create UTC date by subtracting the Eastern Time offset
  // e.g., 7:00 PM ET (GMT-5) = 7:00 PM - (-5) = 7:00 PM + 5 = 12:00 AM UTC next day
  const utcHour = hour - offsetHours;
  return new Date(Date.UTC(year, month, day, utcHour, minute, 0));
}

async function fetchGMEvents(): Promise<FoodcoopEvent[]> {
  const response = await fetch(GM_SOURCE_URL);

  if (!response.ok) {
    throw new Error(`GM Agenda page error: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const events: FoodcoopEvent[] = [];
  const now = new Date();

  const gmHeading = $("h1, h2, h3, h4")
    .filter((_, el) =>
      $(el).text().trim().toLowerCase().includes("psfc general meeting")
    )
    .first();

  const sectionText = gmHeading.length
    ? `${gmHeading.text()} ${gmHeading.nextUntil("h1, h2, h3, h4").text()}`
    : "";

  if (!sectionText) {
    return events;
  }

  const title = "PSFC General Meeting";

  // Parse the date/time from the General Meeting section
  const eventDate = parseGMDateTime(sectionText);
  if (!eventDate) {
    return events;
  }

  // Only return future events
  if (eventDate < now) {
    return events;
  }

  // Try to extract location - look for "Picnic House" mention or address patterns
  let venueName: string | undefined;
  let venueAddress: string | undefined;

  // Look for location pattern like "Picnic House, Prospect Park, 95 Prospect Park West..."
  const locationMatch = sectionText.match(/(Prospect Park Picnic House|Picnic House)/i);
  if (locationMatch) {
    venueName = locationMatch[1].trim();
  }

  // Generate stable ID based on date
  const dateStr = eventDate.toISOString().slice(0, 10);
  const id = `gm-${dateStr}`;

  const startUtc = eventDate.toISOString();

  events.push({
    id,
    title,
    url: GM_AGENDA_URL,
    startUtc,
    timezone: TIMEZONE,
    venueName,
    venueAddress: venueAddress || undefined,
  });

  return events;
}

export async function GET() {
  try {
    const now = Date.now();
    if (!cachedEvents || now - cacheTime > CACHE_DURATION) {
      cachedEvents = await fetchGMEvents();
      cacheTime = now;
    }

    return NextResponse.json({
      events: cachedEvents,
      total: cachedEvents.length,
      lastUpdated: new Date(cacheTime).toISOString(),
    });
  } catch (error) {
    console.error("GM Events API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch GM events" },
      { status: 500 }
    );
  }
}
