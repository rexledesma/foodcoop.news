import type { ProduceRow } from '@/lib/use-produce-data';
import type { ProduceEvent, ProduceEventItem } from '@/lib/types';
import type { FeedItem } from '@/lib/discover-feed-context';

function toProduceEventItem(row: ProduceRow): ProduceEventItem {
  return {
    name: row.name,
  };
}

export function produceRowsToFeedItems(rows: ProduceRow[]): FeedItem[] {
  const newArrivals = rows.filter((r) => r.is_new && r.first_seen_date);
  const outOfStock = rows.filter((r) => r.is_unavailable && r.unavailable_since_date);

  // Group new arrivals by first_seen_date
  const arrivalsByDate = new Map<string, ProduceRow[]>();
  for (const row of newArrivals) {
    const date = row.first_seen_date!;
    const existing = arrivalsByDate.get(date) || [];
    existing.push(row);
    arrivalsByDate.set(date, existing);
  }

  // Group out of stock by unavailable_since_date
  const outOfStockByDate = new Map<string, ProduceRow[]>();
  for (const row of outOfStock) {
    const date = row.unavailable_since_date!;
    const existing = outOfStockByDate.get(date) || [];
    existing.push(row);
    outOfStockByDate.set(date, existing);
  }

  // Merge all unique dates
  const allDates = new Set([...arrivalsByDate.keys(), ...outOfStockByDate.keys()]);

  const feedItems: FeedItem[] = [];

  for (const dateStr of allDates) {
    const arrivals = arrivalsByDate.get(dateStr) || [];
    const unavailable = outOfStockByDate.get(dateStr) || [];

    // Sort alphabetically by name
    arrivals.sort((a, b) => a.name.localeCompare(b.name));
    unavailable.sort((a, b) => a.name.localeCompare(b.name));

    const produceEvent: ProduceEvent = {
      id: dateStr,
      date: dateStr,
      newArrivals: arrivals.map(toProduceEventItem),
      outOfStock: unavailable.map(toProduceEventItem),
    };

    // Parse as local time (not UTC) by appending time component
    feedItems.push({
      type: 'produce',
      data: produceEvent,
      date: new Date(dateStr + 'T07:00:00'),
    });
  }

  return feedItems;
}
