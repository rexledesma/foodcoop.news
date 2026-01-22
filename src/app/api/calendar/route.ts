import { NextResponse } from "next/server";

const SHIFT_CALENDAR_URL =
  "https://calendar.google.com/calendar/ical/9b8f99f4caf33d2afbd17ac5f64a5113c7e373686247a7126b6a0b96a8cbd462%40group.calendar.google.com/public/basic.ics";

export async function GET() {
  try {
    const response = await fetch(SHIFT_CALENDAR_URL);

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch calendar" },
        { status: response.status }
      );
    }

    const calendarText = await response.text();

    return new NextResponse(calendarText, {
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "cache-control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch (error) {
    console.error("Calendar API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendar" },
      { status: 500 }
    );
  }
}
