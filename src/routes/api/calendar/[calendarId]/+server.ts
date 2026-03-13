import { createHash } from 'node:crypto';
import { PUBLIC_CONVEX_URL } from '$env/static/public';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../convex/_generated/api';

const SHIFT_CALENDAR_URL =
  'https://calendar.google.com/calendar/ical/9b8f99f4caf33d2afbd17ac5f64a5113c7e373686247a7126b6a0b96a8cbd462%40group.calendar.google.com/public/basic.ics';

const convex = new ConvexHttpClient(PUBLIC_CONVEX_URL);

const normalizeText = (text: string): string =>
  text
    .toLowerCase()
    .replace(/\*+/g, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

const unfoldLines = (calendarText: string): string[] => {
  const rawLines = calendarText.split(/\r?\n/);
  const lines: string[] = [];

  for (const line of rawLines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length) {
      lines[lines.length - 1] += line.trimStart();
    } else {
      lines.push(line);
    }
  }

  return lines;
};

const parseCalendar = (
  lines: string[],
): { header: string[]; events: string[][]; footer: string[] } => {
  const header: string[] = [];
  const footer: string[] = [];
  const events: string[][] = [];
  let currentEvent: string[] | null = null;
  let hasSeenEvent = false;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      hasSeenEvent = true;
      currentEvent = [line];
      continue;
    }

    if (currentEvent) {
      currentEvent.push(line);
      if (line === 'END:VEVENT') {
        events.push(currentEvent);
        currentEvent = null;
      }
      continue;
    }

    if (!hasSeenEvent) {
      header.push(line);
    } else {
      footer.push(line);
    }
  }

  if (currentEvent) {
    events.push(currentEvent);
  }

  return { header, events, footer };
};

const getSummary = (eventLines: string[]): string => {
  const summaryLine = eventLines.find((line): boolean => line.startsWith('SUMMARY'));
  if (!summaryLine) {
    return '';
  }

  const colonIndex = summaryLine.indexOf(':');
  if (colonIndex === -1) {
    return '';
  }

  return summaryLine.slice(colonIndex + 1);
};

export async function GET({
  params,
  request,
}: {
  params: { calendarId: string };
  request: Request;
}): Promise<Response> {
  try {
    const { calendarId } = params;
    if (!calendarId) {
      return Response.json({ error: 'Missing calendar id' }, { status: 400 });
    }

    const profile = await convex.query(api.memberProfiles.getProfileByCalendarId, { calendarId });

    if (!profile) {
      return Response.json({ error: 'Calendar subscription not found' }, { status: 404 });
    }

    const response = await fetch(SHIFT_CALENDAR_URL);

    if (!response.ok) {
      return Response.json({ error: 'Failed to fetch calendar' }, { status: response.status });
    }

    const calendarText = await response.text();
    const lines = unfoldLines(calendarText);
    const { header, events, footer } = parseCalendar(lines);

    const jobFilters: string[] = Array.isArray(profile.jobFilters) ? profile.jobFilters : [];

    const normalizedFilters = jobFilters
      .map((filter): string => normalizeText(filter))
      .filter(Boolean);

    const filteredEvents =
      normalizedFilters.length === 0
        ? events
        : events.filter((event): boolean => {
            const summary = normalizeText(getSummary(event));
            if (!summary) {
              return false;
            }
            return normalizedFilters.some((filter): boolean => summary.includes(filter));
          });

    const filteredCalendar = [...header, ...filteredEvents.flat(), ...footer].join('\r\n');
    const body = filteredCalendar.endsWith('\r\n') ? filteredCalendar : `${filteredCalendar}\r\n`;

    const etag = `"${createHash('sha256').update(body).digest('hex').slice(0, 16)}"`;

    if (request.headers.get('if-none-match') === etag) {
      return new Response(null, { status: 304, headers: { etag } });
    }

    return new Response(body, {
      headers: {
        'content-type': 'text/calendar; charset=utf-8',
        'cache-control': 'private, max-age=300',
        etag,
      },
    });
  } catch (error) {
    console.error('Calendar API error:', error);
    return Response.json({ error: 'Failed to fetch calendar' }, { status: 500 });
  }
}
