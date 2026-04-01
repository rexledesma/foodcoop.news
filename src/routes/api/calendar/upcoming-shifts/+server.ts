const SHIFT_CALENDAR_URL =
  'https://calendar.google.com/calendar/ical/9b8f99f4caf33d2afbd17ac5f64a5113c7e373686247a7126b6a0b96a8cbd462%40group.calendar.google.com/public/basic.ics';

type ShiftCount = {
  name: string;
  count: number;
};

function unfoldLines(calendarText: string): string[] {
  const rawLines = calendarText.split(/\r?\n/);
  const lines: string[] = [];

  for (const line of rawLines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length > 0) {
      lines[lines.length - 1] += line.trimStart();
      continue;
    }
    lines.push(line);
  }

  return lines;
}

function parseEvents(lines: string[]): string[][] {
  const events: string[][] = [];
  let currentEvent: string[] | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      currentEvent = [line];
      continue;
    }

    if (!currentEvent) {
      continue;
    }

    currentEvent.push(line);
    if (line === 'END:VEVENT') {
      events.push(currentEvent);
      currentEvent = null;
    }
  }

  return events;
}

function readFieldValue(eventLines: string[], fieldName: string): string | null {
  const line = eventLines.find((entry): boolean => entry.startsWith(`${fieldName}`));
  if (!line) {
    return null;
  }

  const colonIndex = line.indexOf(':');
  if (colonIndex === -1) {
    return null;
  }

  const value = line.slice(colonIndex + 1).trim();
  return value.length > 0 ? value : null;
}

function parseIcsDateTime(raw: string): Date | null {
  const dateOnlyMatch = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 0, 0, 0));
  }

  const utcMatch = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (utcMatch) {
    const [, year, month, day, hour, minute, second] = utcMatch;
    return new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
      ),
    );
  }

  const utcNoSecondsMatch = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})Z$/);
  if (utcNoSecondsMatch) {
    const [, year, month, day, hour, minute] = utcNoSecondsMatch;
    return new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), 0),
    );
  }

  const localMatch = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (localMatch) {
    const [, year, month, day, hour, minute, second] = localMatch;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    );
  }

  const localNoSecondsMatch = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})$/);
  if (localNoSecondsMatch) {
    const [, year, month, day, hour, minute] = localNoSecondsMatch;
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), 0);
  }

  return null;
}

function countBullets(description: string): number {
  const matches = description.match(/<li>/gi);
  return matches ? matches.length : 1;
}

function toShiftCounts(events: string[][], now: Date): ShiftCount[] {
  const counts = new Map<string, number>();

  for (const eventLines of events) {
    const summary = readFieldValue(eventLines, 'SUMMARY');
    const dtstartRaw = readFieldValue(eventLines, 'DTSTART');

    if (!summary || !dtstartRaw) {
      continue;
    }

    const start = parseIcsDateTime(dtstartRaw);
    if (!start || Number.isNaN(start.getTime()) || start < now) {
      continue;
    }

    const description = readFieldValue(eventLines, 'DESCRIPTION') ?? '';
    const slots = countBullets(description);
    counts.set(summary, (counts.get(summary) ?? 0) + slots);
  }

  return Array.from(counts.entries())
    .map(([name, count]): ShiftCount => ({ name, count }))
    .sort((a, b): number => {
      if (a.count !== b.count) {
        return a.count - b.count;
      }
      return a.name.localeCompare(b.name);
    });
}

export async function GET(): Promise<Response> {
  try {
    const response = await fetch(SHIFT_CALENDAR_URL);
    if (!response.ok) {
      return Response.json({ error: 'Failed to fetch calendar' }, { status: response.status });
    }

    const calendarText = await response.text();
    const lines = unfoldLines(calendarText);
    const events = parseEvents(lines);
    const now = new Date();
    const shifts = toShiftCounts(events, now);
    const totalUpcomingEvents = shifts.reduce((total, shift): number => total + shift.count, 0);

    return Response.json(
      {
        shifts,
        totalUpcomingEvents,
        asOf: now.toISOString(),
      },
      {
        headers: {
          'cache-control': 'public, max-age=300, s-maxage=300',
        },
      },
    );
  } catch (error) {
    console.error('Upcoming shifts API error:', error);
    return Response.json({ error: 'Failed to fetch upcoming shifts' }, { status: 500 });
  }
}
