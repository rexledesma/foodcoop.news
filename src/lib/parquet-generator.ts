import { ParquetSchema, ParquetWriter } from '@dsnp/parquetjs';
import { randomUUID } from 'crypto';
import { readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type { ProduceItem } from './types';

const PRODUCE_SCHEMA = new ParquetSchema({
  id: { type: 'UTF8' },
  date: { type: 'UTF8' }, // ISO date string
  name: { type: 'UTF8' },
  price: { type: 'DOUBLE' },
  unit: { type: 'UTF8' },
  is_organic: { type: 'BOOLEAN' },
  is_ipm: { type: 'BOOLEAN' },
  is_waxed: { type: 'BOOLEAN' },
  is_local: { type: 'BOOLEAN' },
  is_hydroponic: { type: 'BOOLEAN' },
  origin: { type: 'UTF8' },
});

interface ParquetRow {
  id: string;
  date: string;
  name: string;
  price: number;
  unit: string;
  is_organic: boolean;
  is_ipm: boolean;
  is_waxed: boolean;
  is_local: boolean;
  is_hydroponic: boolean;
  origin: string;
}

function toParquetRow(item: ProduceItem): ParquetRow {
  return {
    id: item.id,
    date: item.date,
    name: item.name,
    price: item.price,
    unit: item.unit,
    is_organic: item.isOrganic,
    is_ipm: item.isIpm,
    is_waxed: item.isWaxed,
    is_local: item.isLocal,
    is_hydroponic: item.isHydroponic,
    origin: item.origin,
  };
}

/**
 * Generate a Parquet file buffer from produce items
 */
export async function generateParquetBuffer(items: ProduceItem[]): Promise<Buffer> {
  const tempPath = join(tmpdir(), `produce-${randomUUID()}.parquet`);

  try {
    const writer = await ParquetWriter.openFile(PRODUCE_SCHEMA, tempPath);

    for (const item of items) {
      const row = toParquetRow(item);
      await writer.appendRow(row as unknown as Record<string, unknown>);
    }

    await writer.close();

    return await readFile(tempPath);
  } finally {
    // Clean up temp file
    await unlink(tempPath).catch(() => {});
  }
}

/**
 * Group produce items by month (YYYY-MM)
 */
export function groupByMonth(items: ProduceItem[]): Map<string, ProduceItem[]> {
  const groups = new Map<string, ProduceItem[]>();

  for (const item of items) {
    const month = item.date.slice(0, 7); // "2025-01-29" -> "2025-01"
    const existing = groups.get(month) ?? [];
    existing.push(item);
    groups.set(month, existing);
  }

  return groups;
}
