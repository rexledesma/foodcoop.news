import { env } from '$env/dynamic/private';
import { google } from 'googleapis';

import {
  type GovernanceApiPayload,
  governancePendingAgendaItemSchema,
  governancePreviousAgendaItemSchema,
  governanceSheetHeaderSchema,
  type GovernancePendingAgendaItem,
  type GovernancePreviousAgendaItem,
} from '@/lib/governance';

const DEFAULT_SHEET_ID = '1yuBxeKZlTtbJLqabrzv2g3SiaxANppmy7GkaHlr8GbA';
const DEFAULT_SHEET_RANGE = 'Pending!A:C';
const DEFAULT_MEETINGS_SHEET_RANGE = 'Meetings!A:E';
const DEFAULT_AGENDA_ITEMS_SHEET_RANGE = 'AgendaItems!A:B';
const SOURCE_PDF_URL =
  'https://www.foodcoop.com/wp-content/uploads/2026/02/2026_02_03_agenda_committee.pdf';
const HARDCODED_LAST_UPDATED_ISO = '2026-02-03T12:00:00.000Z';
const CACHE_DURATION_MS = 5 * 60 * 1000;
const CACHE_CONTROL = 'public, max-age=300, s-maxage=300, stale-while-revalidate=3600';

type ServiceAccountCredentials = {
  client_email: string;
  private_key: string;
};

let cachedPayload: GovernanceApiPayload | null = null;
let cacheTime = 0;

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function parsePendingAgendaItemsFromRows(rawRows: string[][]): GovernancePendingAgendaItem[] {
  const rows = rawRows
    .map((row): string[] => row.map((value): string => collapseWhitespace(value)))
    .filter((row): boolean => row.some((value): boolean => value.length > 0));

  if (rows.length === 0) {
    return [];
  }

  const headerRow = rows[0] ?? [];
  const headerCells = [headerRow[0] ?? '', headerRow[1] ?? '', headerRow[2] ?? ''];
  const headerResult = governanceSheetHeaderSchema.safeParse(headerCells);
  if (!headerResult.success) {
    throw new Error(
      'Invalid governance sheet headers. Expected: Agenda Item Number, Submitted/Revision Date, Subject.',
    );
  }

  return rows
    .slice(1)
    .map((row): GovernancePendingAgendaItem | null => {
      const rowResult = governancePendingAgendaItemSchema.safeParse({
        agendaItemNumber: row[0] ?? '',
        submittedRevisionDate: row[1] ?? '',
        subject: row[2] ?? '',
      });
      if (!rowResult.success) {
        throw new Error('Invalid governance sheet row format.');
      }

      if (!rowResult.data.agendaItemNumber && !rowResult.data.subject) {
        return null;
      }

      return {
        agendaItemNumber: rowResult.data.agendaItemNumber || 'No number assigned',
        submittedRevisionDate: rowResult.data.submittedRevisionDate,
        subject: rowResult.data.subject,
      };
    })
    .filter((item): item is GovernancePendingAgendaItem => Boolean(item));
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseDateKey(value: string): string | null {
  const raw = collapseWhitespace(value);
  if (!raw) {
    return null;
  }

  const yyyyMmDd = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (yyyyMmDd) {
    const year = Number(yyyyMmDd[1]);
    const month = Number(yyyyMmDd[2]);
    const day = Number(yyyyMmDd[3]);
    if (
      Number.isInteger(year) &&
      Number.isInteger(month) &&
      Number.isInteger(day) &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31
    ) {
      return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day
        .toString()
        .padStart(2, '0')}`;
    }
  }

  const slashed = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (slashed) {
    const month = Number(slashed[1]);
    const day = Number(slashed[2]);
    const yearText = slashed[3] ?? '';
    const yearInput = Number(yearText);
    const year = yearText.length === 2 ? 2000 + yearInput : yearInput;
    if (
      Number.isInteger(year) &&
      Number.isInteger(month) &&
      Number.isInteger(day) &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31
    ) {
      return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day
        .toString()
        .padStart(2, '0')}`;
    }
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const year = parsed.getUTCFullYear();
  const month = parsed.getUTCMonth() + 1;
  const day = parsed.getUTCDate();
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day
    .toString()
    .padStart(2, '0')}`;
}

function parsePreviousMeetingsFromRows(
  rawRows: string[][],
  fallbackUrl: string,
): Map<string, Omit<GovernancePreviousAgendaItem, 'agendaSubjects'>> {
  const rows = rawRows
    .map((row): string[] => row.map((value): string => collapseWhitespace(value)))
    .filter((row): boolean => row.some((value): boolean => value.length > 0));

  if (rows.length === 0) {
    return new Map();
  }

  const headerRow = rows[0] ?? [];
  const headerMap = new Map<number, string>();
  headerRow.forEach((value, index): void => {
    headerMap.set(index, normalizeHeader(value));
  });

  const meetingDateColumnIndex =
    [...headerMap.entries()].find(
      ([, value]): boolean => value.includes('date') || value.includes('meeting'),
    )?.[0] ?? 0;
  const minutesUrlColumnIndex =
    [...headerMap.entries()].find(
      ([, value]): boolean => value.includes('url') || value === 'link' || value.includes('minute'),
    )?.[0] ?? 2;
  const gazetteUrlColumnIndex =
    [...headerMap.entries()].find(([, value]): boolean => value.includes('gazetteurl'))?.[0] ??
    [...headerMap.entries()].find(([, value]): boolean => value === 'gazette')?.[0];
  const gazetteTitleColumnIndex =
    [...headerMap.entries()].find(([, value]): boolean => value.includes('gazettetitle'))?.[0] ?? 3;
  const gazettePreviewImageColumnIndex =
    [...headerMap.entries()].find(([, value]): boolean =>
      value.includes('gazettepreviewimageurl'),
    )?.[0] ??
    [...headerMap.entries()].find(([, value]): boolean => value.includes('previewimage'))?.[0] ??
    4;

  const hasHeaderRow = [...headerMap.values()].some(
    (value): boolean =>
      value.includes('date') ||
      value.includes('meeting') ||
      value.includes('url') ||
      value === 'link' ||
      value.includes('minute') ||
      value.includes('gazette') ||
      value.includes('title') ||
      value.includes('previewimage'),
  );
  const dataRows = hasHeaderRow ? rows.slice(1) : rows;

  const meetingsByDate = new Map<string, Omit<GovernancePreviousAgendaItem, 'agendaSubjects'>>();
  for (const row of dataRows) {
    const dateCell = row[meetingDateColumnIndex] ?? '';
    const meetingDate = parseDateKey(dateCell);
    if (!meetingDate) {
      continue;
    }

    const minutesUrlCandidate = collapseWhitespace(row[minutesUrlColumnIndex] ?? '');
    const minutesUrl = minutesUrlCandidate || fallbackUrl;
    const gazetteUrlCandidate =
      gazetteUrlColumnIndex === undefined
        ? ''
        : collapseWhitespace(row[gazetteUrlColumnIndex] ?? '');
    const gazetteTitleCandidate = collapseWhitespace(row[gazetteTitleColumnIndex] ?? '');
    const gazettePreviewImageUrlCandidate = collapseWhitespace(
      row[gazettePreviewImageColumnIndex] ?? '',
    );
    const parsedRow = governancePreviousAgendaItemSchema.safeParse({
      meetingDate,
      minutesUrl,
      gazetteUrl: gazetteUrlCandidate || undefined,
      gazetteTitle: gazetteTitleCandidate || undefined,
      gazettePreviewImageUrl: gazettePreviewImageUrlCandidate || undefined,
      agendaSubjects: [],
    });
    if (!parsedRow.success) {
      throw new Error('Invalid previous governance sheet row format.');
    }

    meetingsByDate.set(meetingDate, parsedRow.data);
  }

  return meetingsByDate;
}

function parsePreviousAgendaItemsFromRows(rawRows: string[][]): Map<string, string[]> {
  const rows = rawRows
    .map((row): string[] => row.map((value): string => collapseWhitespace(value)))
    .filter((row): boolean => row.some((value): boolean => value.length > 0));

  if (rows.length === 0) {
    return new Map();
  }

  const headerRow = rows[0] ?? [];
  const headerMap = new Map<number, string>();
  headerRow.forEach((value, index): void => {
    headerMap.set(index, normalizeHeader(value));
  });

  const meetingDateColumnIndex =
    [...headerMap.entries()].find(
      ([, value]): boolean => value.includes('date') || value.includes('meeting'),
    )?.[0] ?? 0;
  const subjectColumnIndex =
    [...headerMap.entries()].find(([, value]): boolean => value.includes('subject'))?.[0] ?? 1;

  const hasHeaderRow = [...headerMap.values()].some(
    (value): boolean =>
      value.includes('subject') || value.includes('date') || value.includes('meeting'),
  );
  const dataRows = hasHeaderRow ? rows.slice(1) : rows;

  const subjectsByMeetingDate = new Map<string, string[]>();
  for (const row of dataRows) {
    const subject = collapseWhitespace(row[subjectColumnIndex] ?? '');
    if (!subject) {
      continue;
    }

    const meetingDate = parseDateKey(row[meetingDateColumnIndex] ?? '');
    if (!meetingDate) {
      continue;
    }

    const subjects = subjectsByMeetingDate.get(meetingDate);
    if (subjects) {
      subjects.push(subject);
    } else {
      subjectsByMeetingDate.set(meetingDate, [subject]);
    }
  }

  return subjectsByMeetingDate;
}

function resolveSheetConfig(): {
  spreadsheetId: string;
  pendingRange: string;
  meetingsRange: string;
  agendaItemsRange: string;
  sourceUrl: string;
  credentials: ServiceAccountCredentials;
} {
  const clientEmail = env.GOOGLE_SHEETS_CLIENT_EMAIL?.trim();
  const privateKey = env.GOOGLE_SHEETS_PRIVATE_KEY?.trim().replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    throw new Error('GOOGLE_SHEETS_CLIENT_EMAIL and GOOGLE_SHEETS_PRIVATE_KEY are required.');
  }

  const spreadsheetId = env['GOVERNANCE_SHEET_ID']?.trim() || DEFAULT_SHEET_ID;
  const pendingRange = env['GOVERNANCE_SHEET_RANGE']?.trim() || DEFAULT_SHEET_RANGE;
  const meetingsRange =
    env['GOVERNANCE_MEETINGS_SHEET_RANGE']?.trim() || DEFAULT_MEETINGS_SHEET_RANGE;
  const agendaItemsRange =
    env['GOVERNANCE_AGENDA_ITEMS_SHEET_RANGE']?.trim() || DEFAULT_AGENDA_ITEMS_SHEET_RANGE;

  return {
    spreadsheetId,
    pendingRange,
    meetingsRange,
    agendaItemsRange,
    sourceUrl: SOURCE_PDF_URL,
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
  };
}

async function fetchPendingAgendaItemsFromSheet(
  spreadsheetId: string,
  range: string,
  credentials: ServiceAccountCredentials,
): Promise<GovernancePendingAgendaItem[]> {
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  const rows = (response.data.values ?? []).map((row): string[] =>
    row.map((value): string => collapseWhitespace(String(value ?? ''))),
  );
  return parsePendingAgendaItemsFromRows(rows);
}

async function fetchPreviousAgendaItemsFromSheet(
  spreadsheetId: string,
  meetingsRange: string,
  agendaItemsRange: string,
  credentials: ServiceAccountCredentials,
  fallbackUrl: string,
): Promise<GovernancePreviousAgendaItem[]> {
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const [meetingsResponse, agendaItemsResponse] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: meetingsRange,
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: agendaItemsRange,
    }),
  ]);
  const meetingRows = (meetingsResponse.data.values ?? []).map((row): string[] =>
    row.map((value): string => collapseWhitespace(String(value ?? ''))),
  );
  const agendaItemRows = (agendaItemsResponse.data.values ?? []).map((row): string[] =>
    row.map((value): string => collapseWhitespace(String(value ?? ''))),
  );
  const meetingsByDate = parsePreviousMeetingsFromRows(meetingRows, fallbackUrl);
  const agendaSubjectsByMeetingDate = parsePreviousAgendaItemsFromRows(agendaItemRows);

  const previousMeetings = [...meetingsByDate.values()]
    .map(
      (meeting): GovernancePreviousAgendaItem => ({
        ...meeting,
        agendaSubjects: agendaSubjectsByMeetingDate.get(meeting.meetingDate) ?? [],
      }),
    )
    .sort((a, b): number => (a.meetingDate < b.meetingDate ? 1 : -1));

  return previousMeetings;
}

export async function GET(): Promise<Response> {
  const now = Date.now();
  const { spreadsheetId, pendingRange, meetingsRange, agendaItemsRange, sourceUrl, credentials } =
    resolveSheetConfig();

  if (
    cachedPayload &&
    now - cacheTime < CACHE_DURATION_MS &&
    cachedPayload.sourceUrl === sourceUrl
  ) {
    return Response.json(cachedPayload, {
      headers: { 'cache-control': CACHE_CONTROL },
    });
  }

  try {
    const items = await fetchPendingAgendaItemsFromSheet(spreadsheetId, pendingRange, credentials);
    let previousItems: GovernancePreviousAgendaItem[] = [];
    try {
      previousItems = await fetchPreviousAgendaItemsFromSheet(
        spreadsheetId,
        meetingsRange,
        agendaItemsRange,
        credentials,
        sourceUrl,
      );
    } catch (error) {
      console.warn('Failed to load previous agenda items from sheet:', error);
      previousItems = [];
    }
    const payload: GovernanceApiPayload = {
      sourceUrl,
      lastUpdated: HARDCODED_LAST_UPDATED_ISO,
      items,
      previousItems,
    };
    cachedPayload = payload;
    cacheTime = now;

    return Response.json(payload, {
      headers: { 'cache-control': CACHE_CONTROL },
    });
  } catch (error) {
    console.error('Failed to load governance pending agenda items from sheet:', error);
    return Response.json(
      {
        sourceUrl,
        lastUpdated: HARDCODED_LAST_UPDATED_ISO,
        items: [] as GovernancePendingAgendaItem[],
        previousItems: [] as GovernancePreviousAgendaItem[],
        error: 'Unable to load pending agenda items from Google Sheets.',
      },
      {
        status: 502,
        headers: { 'cache-control': 'no-store' },
      },
    );
  }
}
