import { NextResponse } from "next/server";
import { fetchAuthQuery } from "@/lib/auth";
import { api } from "../../../../../convex/_generated/api";
import { generateGoogleWalletURL } from "@/lib/google-wallet";

export const runtime = "nodejs";

export async function GET() {
  try {
    const profile = await fetchAuthQuery(
      api.memberProfiles.getMemberProfile,
      {},
    );

    if (!profile) {
      return NextResponse.json(
        { error: "Not authenticated or profile not found" },
        { status: 401 },
      );
    }

    const params = {
      memberId: profile.memberId,
      memberName: profile.memberName,
      serialNumber: profile.passSerialNumber,
    };
    const url = generateGoogleWalletURL(params);

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Google Wallet pass generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate pass" },
      { status: 500 },
    );
  }
}
