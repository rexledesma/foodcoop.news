import { NextRequest, NextResponse } from "next/server";
import { scrapeProduce, filterProduce } from "@/lib/produce";

// Cache produce data for 5 minutes
let cachedProduce: Awaited<ReturnType<typeof scrapeProduce>> | null = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") || "";
    const organicOnly = searchParams.get("organic") === "true";

    // Check cache
    const now = Date.now();
    if (!cachedProduce || now - cacheTime > CACHE_DURATION) {
      cachedProduce = await scrapeProduce();
      cacheTime = now;
    }

    const filtered = filterProduce(cachedProduce, query, organicOnly);

    return NextResponse.json({
      produce: filtered,
      total: filtered.length,
      lastUpdated: new Date(cacheTime).toISOString(),
    });
  } catch (error) {
    console.error("Produce API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch produce data" },
      { status: 500 }
    );
  }
}
