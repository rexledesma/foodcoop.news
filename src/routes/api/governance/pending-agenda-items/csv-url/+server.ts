import { env } from '$env/dynamic/private';

import { getAirtableSharedViewCsvUrl } from '@/lib/airtable-shared-view';

const DEFAULT_PENDING_AGENDA_AIRTABLE_URL =
  'https://airtable.com/appqMfYTqdRaWqxsr/shr6fE6NN4XrlicPz/tblmo5foohrWXqdKU';

export async function GET(): Promise<Response> {
  const sourceUrl =
    env['GOVERNANCE_PENDING_AGENDA_AIRTABLE_URL']?.trim() || DEFAULT_PENDING_AGENDA_AIRTABLE_URL;

  try {
    const csvUrl = await getAirtableSharedViewCsvUrl(sourceUrl);
    return Response.json(
      {
        sourceUrl,
        csvUrl,
      },
      {
        headers: {
          'cache-control': 'no-store',
        },
      },
    );
  } catch (error) {
    console.error('Failed to extract Airtable pending agenda CSV URL:', error);
    return Response.json(
      {
        sourceUrl,
        error: 'Unable to extract Airtable CSV URL.',
      },
      {
        status: 502,
        headers: {
          'cache-control': 'no-store',
        },
      },
    );
  }
}
