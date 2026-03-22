import type { PageServerLoad } from './$types';
import type { ProduceEvent } from '@/lib/types';

type ProduceJsonLdItem = {
  name: string;
  date: string;
  url: string;
};

type ProduceUpdatesResponse = {
  events?: ProduceEvent[];
};

function isGooglebotUserAgent(userAgent: string): boolean {
  const value = userAgent.toLowerCase();
  if (!value) {
    return false;
  }
  return value.includes('googlebot');
}

function toProduceItemUrl(origin: string, date: string, produceName: string): string {
  const baseUrl = new URL('/produce', origin);
  baseUrl.searchParams.set('date', date);
  baseUrl.searchParams.set('produce', produceName);
  return baseUrl.toString();
}

function sortProduceItems(a: ProduceJsonLdItem, b: ProduceJsonLdItem): number {
  if (a.date !== b.date) {
    return b.date.localeCompare(a.date);
  }
  return a.name.localeCompare(b.name);
}

export const load: PageServerLoad = async ({ fetch, request, url }) => {
  const userAgent = request.headers.get('user-agent') ?? '';
  if (!isGooglebotUserAgent(userAgent)) {
    return {
      newArrivals: [] as ProduceJsonLdItem[],
      outOfStock: [] as ProduceJsonLdItem[],
    };
  }

  try {
    const response = await fetch('/api/produce/updates');
    if (!response.ok) {
      return {
        newArrivals: [] as ProduceJsonLdItem[],
        outOfStock: [] as ProduceJsonLdItem[],
      };
    }

    const payload = (await response.json()) as ProduceUpdatesResponse;
    const newArrivals: ProduceJsonLdItem[] = [];
    const outOfStock: ProduceJsonLdItem[] = [];

    for (const event of payload.events ?? []) {
      if (!event?.date) {
        continue;
      }

      for (const arrival of event.newArrivals ?? []) {
        if (!arrival?.name) {
          continue;
        }
        newArrivals.push({
          name: arrival.name,
          date: event.date,
          url: toProduceItemUrl(url.origin, event.date, arrival.name),
        });
      }

      for (const unavailable of event.outOfStock ?? []) {
        if (!unavailable?.name) {
          continue;
        }
        outOfStock.push({
          name: unavailable.name,
          date: event.date,
          url: toProduceItemUrl(url.origin, event.date, unavailable.name),
        });
      }
    }

    return {
      newArrivals: newArrivals.sort(sortProduceItems).slice(0, 10),
      outOfStock: outOfStock.sort(sortProduceItems).slice(0, 10),
    };
  } catch {
    return {
      newArrivals: [] as ProduceJsonLdItem[],
      outOfStock: [] as ProduceJsonLdItem[],
    };
  }
};
