import { NextResponse } from "next/server";
import { list } from "@vercel/blob";

export async function GET() {
  try {
    const { blobs } = await list({
      prefix: "produce-data/",
      token: process.env.VERCEL_BLOB_READ_WRITE_TOKEN,
    });

    const currentMonth = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/New_York",
    }).slice(0, 7);

    const months = blobs
      .filter((blob) => blob.pathname.endsWith(".parquet"))
      .map((blob) => {
        const match = blob.pathname.match(/produce-data\/(\d{4}-\d{2})\.parquet$/);
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
      .sort((a, b) => b!.month.localeCompare(a!.month)); // Most recent first

    return NextResponse.json({ months });
  } catch (error) {
    console.error("Produce metadata error:", error);
    return NextResponse.json(
      { error: "Failed to list produce data" },
      { status: 500 }
    );
  }
}
