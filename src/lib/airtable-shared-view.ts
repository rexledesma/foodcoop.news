const AIRTABLE_SHARED_VIEW_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';

type AirtableSharedViewInitData = {
  accessPolicy?: unknown;
  pageLoadId?: unknown;
  sharedModelParentApplicationId?: unknown;
  sharedViewId?: unknown;
};

function assertString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Airtable shared view page did not include ${fieldName}.`);
  }

  return value;
}

function createRequestId(): string {
  return `req${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function parseInitData(html: string): AirtableSharedViewInitData {
  const match = html.match(/window\.initData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
  if (!match?.[1]) {
    throw new Error('Airtable shared view page did not include window.initData.');
  }

  const parsed: unknown = JSON.parse(match[1]);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Airtable shared view init data was not an object.');
  }

  return parsed as AirtableSharedViewInitData;
}

export async function getAirtableSharedViewCsvUrl(
  sharedViewUrl: string,
  options: {
    fetchFn?: typeof fetch;
    timeZone?: string;
  } = {},
): Promise<string> {
  const fetchFn = options.fetchFn ?? fetch;
  const timeZone = options.timeZone ?? 'America/New_York';
  const pageResponse = await fetchFn(sharedViewUrl, {
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
      'user-agent': AIRTABLE_SHARED_VIEW_USER_AGENT,
    },
  });

  if (!pageResponse.ok) {
    throw new Error(`Airtable shared view page returned ${pageResponse.status}.`);
  }

  const initData = parseInitData(await pageResponse.text());
  const accessPolicy = assertString(initData.accessPolicy, 'accessPolicy');
  const applicationId = assertString(
    initData.sharedModelParentApplicationId,
    'sharedModelParentApplicationId',
  );
  const pageLoadId = assertString(initData.pageLoadId, 'pageLoadId');
  const viewId = assertString(initData.sharedViewId, 'sharedViewId');
  const exportUrl = new URL(`/v0.3/view/${viewId}/downloadCsv`, sharedViewUrl);
  exportUrl.searchParams.set('requestId', createRequestId());
  exportUrl.searchParams.set('accessPolicy', accessPolicy);

  const exportResponse = await fetchFn(exportUrl, {
    redirect: 'manual',
    headers: {
      accept: '*/*',
      referer: sharedViewUrl,
      'user-agent': AIRTABLE_SHARED_VIEW_USER_AGENT,
      'x-airtable-application-id': applicationId,
      'x-airtable-inter-service-client': 'webClient',
      'x-airtable-page-load-id': pageLoadId,
      'x-requested-with': 'XMLHttpRequest',
      'x-time-zone': timeZone,
      'x-user-locale': 'en',
    },
  });

  const location = exportResponse.headers.get('location');
  if (!location || (exportResponse.status !== 302 && exportResponse.status !== 303)) {
    const body = await exportResponse.text();
    throw new Error(`Airtable CSV export returned ${exportResponse.status}: ${body.slice(0, 200)}`);
  }

  const csvUrl = new URL(location, sharedViewUrl);
  if (!csvUrl.pathname.endsWith('.csv')) {
    throw new Error('Airtable CSV export redirect did not point to a CSV file.');
  }

  return csvUrl.toString();
}
