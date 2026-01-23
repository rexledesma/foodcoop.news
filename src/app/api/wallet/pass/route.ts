import { NextResponse } from "next/server";
import { fetchAuthQuery } from "@/lib/auth";
import { api } from "../../../../../convex/_generated/api";
import { generatePKPass } from "@/lib/apple-pass";

export const runtime = "nodejs";

export async function GET() {
  try {
    const profile = await fetchAuthQuery(api.memberProfiles.getMemberProfile, {});

    if (!profile) {
      return NextResponse.json(
        { error: "Not authenticated or profile not found" },
        { status: 401 }
      );
    }

    const passBuffer = await generatePKPass({
      memberId: profile.memberId,
      memberName: profile.memberName,
      serialNumber: profile.passSerialNumber,
    });

    return new NextResponse(new Uint8Array(passBuffer), {
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": 'attachment; filename="psfc-member-card.pkpass"',
      },
    });
  } catch (error) {
    console.error("Wallet pass generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate pass" },
      { status: 500 }
    );
  }
}
