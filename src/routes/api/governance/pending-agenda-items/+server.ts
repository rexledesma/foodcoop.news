import { env } from '$env/dynamic/private';
import { google } from 'googleapis';

import {
  type GovernanceApiPayload,
  governancePendingAgendaItemSchema,
  governanceSheetHeaderSchema,
  type GovernancePendingAgendaItem,
} from '@/lib/governance';

const DEFAULT_SHEET_ID = '1yuBxeKZlTtbJLqabrzv2g3SiaxANppmy7GkaHlr8GbA';
const DEFAULT_SHEET_RANGE = 'Pending!A:D';
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
  const headerCells = [
    headerRow[0] ?? '',
    headerRow[1] ?? '',
    headerRow[2] ?? '',
    headerRow[3] ?? '',
  ];
  const headerResult = governanceSheetHeaderSchema.safeParse(headerCells);
  if (!headerResult.success) {
    throw new Error(
      'Invalid governance sheet headers. Expected: Agenda Item Number, Submitted/Revision Date, Subject, Discussion.',
    );
  }

  return rows
    .slice(1)
    .map((row): GovernancePendingAgendaItem | null => {
      const rowResult = governancePendingAgendaItemSchema.safeParse({
        agendaItemNumber: row[0] ?? '',
        submittedRevisionDate: row[1] ?? '',
        subject: row[2] ?? '',
        discussion: row[3] ?? '',
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
        discussion: rowResult.data.discussion,
      };
    })
    .filter((item): item is GovernancePendingAgendaItem => Boolean(item));
}

function resolveSheetConfig(): {
  spreadsheetId: string;
  range: string;
  sourceUrl: string;
  credentials: ServiceAccountCredentials;
} {
  const clientEmail = env.GOOGLE_SHEETS_CLIENT_EMAIL?.trim();
  const privateKey = env.GOOGLE_SHEETS_PRIVATE_KEY?.trim().replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    throw new Error('GOOGLE_SHEETS_CLIENT_EMAIL and GOOGLE_SHEETS_PRIVATE_KEY are required.');
  }

  const spreadsheetId = env['GOVERNANCE_SHEET_ID']?.trim() || DEFAULT_SHEET_ID;
  const range = env['GOVERNANCE_SHEET_RANGE']?.trim() || DEFAULT_SHEET_RANGE;

  return {
    spreadsheetId,
    range,
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

export async function GET(): Promise<Response> {
  const now = Date.now();
  const { spreadsheetId, range, sourceUrl, credentials } = resolveSheetConfig();

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
    const items = await fetchPendingAgendaItemsFromSheet(spreadsheetId, range, credentials);
    const payload: GovernanceApiPayload = {
      sourceUrl,
      lastUpdated: HARDCODED_LAST_UPDATED_ISO,
      items,
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
        error: 'Unable to load pending agenda items from Google Sheets.',
      },
      {
        status: 502,
        headers: { 'cache-control': 'no-store' },
      },
    );
  }
}
