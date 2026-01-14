import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fetchShifts } from "@/lib/foodcoop-client";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("foodcoop_session");

    if (!sessionCookie) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const session = JSON.parse(sessionCookie.value);

    if (!session.cookies) {
      return NextResponse.json(
        { error: "Session expired" },
        { status: 401 }
      );
    }

    const shifts = await fetchShifts(session.cookies);

    return NextResponse.json({
      shifts,
      total: shifts.length,
    });
  } catch (error) {
    console.error("Shifts API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch shifts" },
      { status: 500 }
    );
  }
}
