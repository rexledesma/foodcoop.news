import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.VERCEL_CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const maxRetries = 3;
    let lastError: unknown;
    let html: string | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch("https://www.foodcoop.com/produce");
        if (!response.ok) {
          lastError = new Error(`HTTP ${response.status}`);
          continue;
        }
        html = await response.text();
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!html) {
      console.error("Failed to fetch produce page after retries:", lastError);
      return NextResponse.json(
        { error: "Failed to fetch produce page" },
        { status: 502 }
      );
    }

    const date = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/New_York",
    }); // "YYYY-MM-DD"
    const blob = await put(`produce/${date}.html`, html, {
      contentType: "text/html",
      access: "public",
      token: process.env.VERCEL_BLOB_READ_WRITE_TOKEN,
    });

    return NextResponse.json({
      success: true,
      url: blob.url,
      size: html.length,
    });
  } catch (error) {
    console.error("Scrape produce error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
