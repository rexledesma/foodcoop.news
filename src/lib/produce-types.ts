export type ProduceUnit = 'pound' | 'each' | 'bunch';

export interface ProduceItem {
  id: string; // e.g., "2025-01-29-apple-honeycrisp"
  date: string; // ISO date, e.g., "2025-01-29"
  name: string; // Original name from HTML
  price: number; // e.g., 2.40
  unit: ProduceUnit;
  isOrganic: boolean;
  isIpm: boolean; // Integrated Pest Management
  isWaxed: boolean;
  isLocal: boolean; // Within 500 miles
  isHydroponic: boolean;
  origin: string; // Full origin text
}

export interface ParsedProducePage {
  date: string;
  items: ProduceItem[];
}
