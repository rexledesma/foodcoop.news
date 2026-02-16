import { list } from '@vercel/blob';
import { parseProduceHtml } from '@/lib/produce-parser';

type ProduceRow = {
  name: string;
  price: number;
  prev_day_price: number | null;
  prev_week_price: number | null;
  prev_month_price: number | null;
  prev_3_month_price: number | null;
  prev_6_month_price: number | null;
  prev_year_price: number | null;
  prev_2_year_price: number | null;
  prev_ytd_price: number | null;
  day_high: number | null;
  day_low: number | null;
  week_high: number | null;
  week_low: number | null;
  month_high: number | null;
  month_low: number | null;
  three_month_high: number | null;
  three_month_low: number | null;
  six_month_high: number | null;
  six_month_low: number | null;
  year_high: number | null;
  year_low: number | null;
  two_year_high: number | null;
  two_year_low: number | null;
  ytd_high: number | null;
  ytd_low: number | null;
  is_organic: boolean;
  is_ipm: boolean;
  is_waxed: boolean;
  is_local: boolean;
  is_hydroponic: boolean;
  is_new: boolean;
  first_seen_date: string | null;
  origin: string;
  unit: string;
  is_unavailable: boolean;
  unavailable_since_date: string | null;
};

export async function GET() {
  try {
    const { blobs } = await list({
      prefix: 'produce/',
      token: process.env.VERCEL_BLOB_READ_WRITE_TOKEN,
    });

    const htmlBlobs = blobs.filter((blob) =>
      /produce\/\d{4}-\d{2}-\d{2}\.html$/.test(blob.pathname),
    );
    if (htmlBlobs.length === 0) {
      return Response.json({ rows: [], dateRange: null, history: [] });
    }

    const latest = [...htmlBlobs].sort((a, b) => {
      return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
    })[0];

    const dateMatch = latest.pathname.match(/produce\/(\d{4}-\d{2}-\d{2})\.html$/);
    const date = dateMatch?.[1];
    if (!date) {
      return Response.json({ rows: [], dateRange: null, history: [] });
    }

    const response = await fetch(latest.url);
    if (!response.ok) {
      return Response.json({ error: 'Failed to fetch latest produce snapshot' }, { status: 502 });
    }

    const html = await response.text();
    const parsed = parseProduceHtml(html, date);

    const rows: ProduceRow[] = parsed.items
      .map((item) => ({
        name: item.name,
        price: item.price,
        prev_day_price: null,
        prev_week_price: null,
        prev_month_price: null,
        prev_3_month_price: null,
        prev_6_month_price: null,
        prev_year_price: null,
        prev_2_year_price: null,
        prev_ytd_price: null,
        day_high: null,
        day_low: null,
        week_high: null,
        week_low: null,
        month_high: null,
        month_low: null,
        three_month_high: null,
        three_month_low: null,
        six_month_high: null,
        six_month_low: null,
        year_high: null,
        year_low: null,
        two_year_high: null,
        two_year_low: null,
        ytd_high: null,
        ytd_low: null,
        is_organic: item.isOrganic,
        is_ipm: item.isIpm,
        is_waxed: item.isWaxed,
        is_local: item.isLocal,
        is_hydroponic: item.isHydroponic,
        is_new: false,
        first_seen_date: null,
        origin: item.origin,
        unit: item.unit,
        is_unavailable: false,
        unavailable_since_date: null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return Response.json({
      rows,
      dateRange: { start: date, end: date },
      history: [] as Array<[string, Array<{ name: string; date: string; price: number }>]>,
    });
  } catch (error) {
    console.error('Failed to load current produce rows:', error);
    return Response.json({ error: 'Failed to load produce data' }, { status: 500 });
  }
}
