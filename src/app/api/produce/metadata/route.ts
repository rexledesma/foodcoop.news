import { NextResponse } from "next/server";
import { list } from "@vercel/blob";
import { unstable_cache } from "next/cache";

function getNewYorkDate(date: Date) {
  const nyString = date.toLocaleString("en-US", {
    timeZone: "America/New_York",
  });
  return new Date(nyString);
}

function getCacheKeyDate() {
  const nowNy = getNewYorkDate(new Date());
  if (nowNy.getHours() < 8) {
    nowNy.setDate(nowNy.getDate() - 1);
  }
  return nowNy.toLocaleDateString("en-CA");
}

function getSecondsUntilNext8am() {
  const nowNy = getNewYorkDate(new Date());
  const nextNy = new Date(nowNy);

  if (nowNy.getHours() >= 8) {
    nextNy.setDate(nextNy.getDate() + 1);
  }

  nextNy.setHours(8, 0, 0, 0);
  return Math.max(0, Math.round((nextNy.getTime() - nowNy.getTime()) / 1000));
}

async function loadProduceMetadata() {
  const { blobs } = await list({
    prefix: "produce-data/",
    token: process.env.VERCEL_BLOB_READ_WRITE_TOKEN,
  });

  const currentMonth = new Date()
    .toLocaleDateString("en-CA", {
      timeZone: "America/New_York",
    })
    .slice(0, 7);

  const months = blobs
    .filter((blob) => blob.pathname.endsWith(".parquet"))
    .map((blob) => {
      const match = blob.pathname.match(
        /produce-data\/(\d{4}-\d{2})\.parquet$/,
      );
      if (!match) return null;

      const month = match[1];
      return {
        month,
        url: blob.url,
        size: blob.size,
        isCurrentMonth: month === currentMonth,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b!.month.localeCompare(a!.month));

  return { months };
}

export async function GET() {
  try {
    const cacheKey = getCacheKeyDate();
    const cached = unstable_cache(loadProduceMetadata, [
      "produce-metadata",
      cacheKey,
    ]);
    const data = await cached();
    const secondsUntilNext8am = getSecondsUntilNext8am();

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": `public, max-age=${secondsUntilNext8am}, s-maxage=${secondsUntilNext8am}, stale-while-revalidate=86400`,
      },
    });
  } catch (error) {
    console.error("Produce metadata error:", error);
    return NextResponse.json(
      { error: "Failed to list produce data" },
      { status: 500 }
    );
  }
}
