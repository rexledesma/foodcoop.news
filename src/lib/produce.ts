import * as cheerio from "cheerio";
import type { Produce } from "./types";

const PRODUCE_URL = "https://www.foodcoop.com/produce/";

export async function scrapeProduce(): Promise<Produce[]> {
  const response = await fetch(PRODUCE_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; FoodCoopTech/1.0; +https://foodcoop.tech)",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch produce: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const produce: Produce[] = [];

  // The produce page has a table with sortable columns
  $("table tbody tr").each((index, element) => {
    const cells = $(element).find("td");
    if (cells.length >= 4) {
      const name = $(cells[0]).text().trim();
      const priceText = $(cells[1]).text().trim();
      const practiceText = $(cells[2]).text().trim().toLowerCase();
      const origin = $(cells[3]).text().trim();

      // Parse price and unit
      const priceMatch = priceText.match(/\$?([\d.]+)\s*(per pound|each)?/i);
      const price = priceMatch ? `$${priceMatch[1]}` : priceText;
      const priceUnit = priceText.toLowerCase().includes("per pound")
        ? "per pound"
        : priceText.toLowerCase().includes("each")
          ? "each"
          : "unknown";

      // Determine growing practice
      const organic = practiceText.includes("organic");
      const growingPractice = practiceText.includes("organic")
        ? "Organic"
        : practiceText.includes("integrated") || practiceText.includes("ipm")
          ? "Integrated Pest Management"
          : practiceText.includes("conventional")
            ? "Conventional"
            : practiceText;

      produce.push({
        id: `produce-${index}`,
        name,
        price,
        priceUnit,
        organic,
        growingPractice,
        origin,
      });
    }
  });

  return produce;
}

export function filterProduce(
  produce: Produce[],
  query: string,
  organicOnly: boolean = false
): Produce[] {
  let filtered = produce;

  if (query) {
    const lowerQuery = query.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.origin.toLowerCase().includes(lowerQuery)
    );
  }

  if (organicOnly) {
    filtered = filtered.filter((p) => p.organic);
  }

  return filtered;
}
