import * as cheerio from 'cheerio';

import type { FoodcoopEvent } from '@/lib/types';

const ORIENTATION_SOURCE_URL = 'https://ort.foodcoop.com/home/';
const TIMEZONE = 'America/New_York';

// Cache event data for 5 minutes
let cachedEvents: FoodcoopEvent[] | null = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000;

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseUsDate(value: string): { year: number; month: number; day: number } | null {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) {
    return null;
  }

  const monthStr = match[1];
  const dayStr = match[2];
  const yearStr = match[3];
  if (!monthStr || !dayStr || !yearStr) {
    return null;
  }
  const month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);
  const year = Number.parseInt(yearStr, 10);

  if (
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(year) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    year < 2000
  ) {
    return null;
  }

  return { year, month: month - 1, day };
}

function easternDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const refDate = new Date(Date.UTC(year, month, day, 12, 0, 0));
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    timeZoneName: 'shortOffset',
  });
  const parts = formatter.formatToParts(refDate);
  const tzPart = parts.find((part) => part.type === 'timeZoneName');
  const offsetMatch = tzPart?.value.match(/GMT([+-]\d+)/);
  const offsetHours = offsetMatch?.[1] ? Number.parseInt(offsetMatch[1], 10) : -5;
  const utcHour = hour - offsetHours;
  return new Date(Date.UTC(year, month, day, utcHour, minute, 0));
}

function parseOrientationEvents(html: string): FoodcoopEvent[] {
  const $ = cheerio.load(html);
  const heading = $('h3')
    .filter((_, el) => normalizeWhitespace($(el).text()).toLowerCase() === 'upcoming orientations')
    .first();

  if (!heading.length) {
    return [];
  }

  const list = heading.nextAll('ul').first();
  if (!list.length) {
    return [];
  }

  const now = new Date();
  const events: FoodcoopEvent[] = [];

  for (const li of list.find('li').toArray()) {
    const $li = $(li);
    const releaseText = normalizeWhitespace($li.find('div.gray').first().text());
    const releaseMatch = releaseText.match(
      /Released\s+at\s+7\s*pm\s+on\s+(?:[A-Za-z]+\s+)?(\d{1,2}\/\d{1,2}\/\d{4})/i,
    );
    if (!releaseMatch) {
      continue;
    }

    const appointmentText = normalizeWhitespace(
      $li.clone().children('div.gray').remove().end().text(),
    );
    const appointmentMatch = appointmentText.match(
      /^([A-Za-z]+)\s+(\d{1,2}\/\d{1,2}\/\d{4})\s*:\s*(\d+)\s+appointments?,\s*(\d{1,2}:\d{2}\s*[ap]m)$/i,
    );

    const releaseDateText = releaseMatch[1];
    if (!releaseDateText) {
      continue;
    }
    const releaseParts = parseUsDate(releaseDateText);
    if (!releaseParts) {
      continue;
    }
    const releaseDate = easternDateTimeToUtc(
      releaseParts.year,
      releaseParts.month,
      releaseParts.day,
      19,
      0,
    );
    if (releaseDate <= now) {
      continue;
    }

    let title = 'Orientation registration opens';
    let description = 'Schedule an in-person orientation to join the Park Slope Food Coop.';
    let appointmentIdPart = releaseDateText;

    if (appointmentMatch) {
      const weekday = appointmentMatch[1];
      const appointmentDate = appointmentMatch[2] ?? releaseDateText;
      title = `Orientation registration opens (${weekday} ${appointmentDate})`;
      description = `Schedule an in-person orientation to join the Park Slope Food Coop on ${weekday} ${appointmentDate}.`;
      appointmentIdPart = appointmentDate;
    }

    const releaseId = releaseDateText.replaceAll('/', '-');
    const appointmentId = appointmentIdPart.replaceAll('/', '-');
    events.push({
      id: `orientation-registration-${releaseId}-${appointmentId}`,
      title,
      description,
      url: ORIENTATION_SOURCE_URL,
      startUtc: releaseDate.toISOString(),
      timezone: TIMEZONE,
    });
  }

  return events.sort((a, b): number => a.startUtc.localeCompare(b.startUtc));
}

async function fetchOrientationEvents(): Promise<FoodcoopEvent[]> {
  const response = await fetch(ORIENTATION_SOURCE_URL);
  if (!response.ok) {
    throw new Error(`Orientation page error: ${response.status}`);
  }

  const html = await response.text();
  return parseOrientationEvents(html);
}

export async function GET() {
  try {
    const now = Date.now();
    if (!cachedEvents || now - cacheTime > CACHE_DURATION) {
      cachedEvents = await fetchOrientationEvents();
      cacheTime = now;
    }

    return Response.json({
      events: cachedEvents,
      total: cachedEvents.length,
      lastUpdated: new Date(cacheTime).toISOString(),
    });
  } catch (error) {
    console.error('Orientation events API error:', error);
    return Response.json({ error: 'Failed to fetch orientation events' }, { status: 500 });
  }
}
