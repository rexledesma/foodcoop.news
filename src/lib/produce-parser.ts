import * as cheerio from 'cheerio';
import type { ProduceItem, ProduceUnit, ParsedProducePage } from './produce-types';

export function parseProduceHtml(html: string, date: string): ParsedProducePage {
  const $ = cheerio.load(html);
  const items: ProduceItem[] = [];

  $('table.produce tbody tr').each((_, row) => {
    const tds = $(row).find('td');
    if (tds.length < 4) return;

    const nameCell = $(tds[0]).find('div').first().text().trim();
    const priceCell = $(tds[1]).text().trim();
    const attrsCell = $(tds[2]).text().trim();
    const originCell = $(tds[3]).text().trim();

    if (!nameCell || !priceCell) return;

    const { price, unit } = parsePrice(priceCell);
    const attrs = parseAttributes(attrsCell, nameCell);
    const isLocal = parseOriginIsLocal(originCell);

    const id = generateId(date, nameCell);

    items.push({
      id,
      date,
      name: nameCell,
      price,
      unit,
      isOrganic: attrs.isOrganic,
      isIpm: attrs.isIpm,
      isWaxed: attrs.isWaxed,
      isLocal,
      isHydroponic: attrs.isHydroponic,
      origin: originCell,
    });
  });

  return { date, items };
}

function generateId(date: string, name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${date}-${slug}`;
}

export function parsePrice(priceStr: string): {
  price: number;
  unit: ProduceUnit;
} {
  const match = priceStr.match(/\$?([\d.]+)/);
  const price = match ? parseFloat(match[1]) : 0;

  let unit: ProduceUnit = 'each';
  const lower = priceStr.toLowerCase();
  if (lower.includes('pound') || lower.includes('lb')) {
    unit = 'pound';
  } else if (lower.includes('bunch')) {
    unit = 'bunch';
  }

  return { price, unit };
}

export function parseAttributes(
  attrsCell: string,
  rawName: string,
): {
  isOrganic: boolean;
  isIpm: boolean;
  isWaxed: boolean;
  isHydroponic: boolean;
} {
  const combined = `${attrsCell} ${rawName}`.toLowerCase();

  return {
    isOrganic: combined.includes('organic'),
    isIpm: combined.includes('integrated pest management') || combined.includes(' ipm'),
    isWaxed: combined.includes('waxed'),
    isHydroponic: combined.includes('hydroponic'),
  };
}

export function parseOriginIsLocal(originStr: string): boolean {
  const lower = originStr.toLowerCase();
  return lower.includes('locally grown') || lower.includes('500 miles');
}
