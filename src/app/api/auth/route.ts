import { NextRequest, NextResponse } from "next/server";
import { login } from "@/lib/foodcoop-client";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    const result = await login(username, password);

    if (result.success && result.session) {
      // Store session in encrypted cookie
      const cookieStore = await cookies();
      cookieStore.set("foodcoop_session", JSON.stringify(result.session), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24, // 24 hours
        path: "/",
      });

      return NextResponse.json({
        success: true,
        member: result.session.member,
      });
    }

    return NextResponse.json(
      { error: result.error || "Login failed" },
      { status: 401 }
    );
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json(
      { error: "An error occurred during authentication" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("foodcoop_session");

    if (!sessionCookie) {
      return NextResponse.json({ authenticated: false });
    }

    const session = JSON.parse(sessionCookie.value);

    // Check if session is expired
    if (session.expiresAt && session.expiresAt < Date.now()) {
      cookieStore.delete("foodcoop_session");
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({
      authenticated: true,
      member: session.member,
    });
  } catch {
    return NextResponse.json({ authenticated: false });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("foodcoop_session");
  return NextResponse.json({ success: true });
}
