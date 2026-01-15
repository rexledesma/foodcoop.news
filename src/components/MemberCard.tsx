"use client";

import { useEffect, useRef } from "react";
import type { Member } from "@/lib/types";
import PDF417 from "pdf417-generator";

interface MemberCardProps {
  member: Member;
}

export function MemberCard({ member }: MemberCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Use decoded barcode value (zero-padded) if available, otherwise fall back to member number
  const barcodeData = member.barcodeValue || member.memberNumber;

  useEffect(() => {
    if (canvasRef.current && barcodeData) {
      PDF417.draw(barcodeData, canvasRef.current, 5, -1, 2);
    }
  }, [barcodeData]);

  return (
    <div className="w-full max-w-sm mx-auto font-[family-name:var(--font-fira-sans)]">
      <div className="bg-gradient-to-br from-[#4A6741] to-[#3A5331] rounded-2xl shadow-xl overflow-hidden">
        {/* Card Header */}
        <div className="px-6 pt-10 pb-8 flex justify-between items-start">
          <div>
            <h2 className="text-[#FDDB74] text-sm font-semibold">
              🥕 PARK SLOPE FOOD COOP
            </h2>
            <p className="text-white text-xl font-bold mt-1">{member.name}</p>
            <p className="text-white text-xl font-mono font-bold tracking-wider">
              {member.memberNumber}
            </p>
          </div>
          <button
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            onClick={() => alert("Wallet integration coming soon!")}
            aria-label="Add to Wallet"
          >
            <svg
              className="w-5 h-5 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M21 7H3a2 2 0 00-2 2v10a2 2 0 002 2h18a2 2 0 002-2V9a2 2 0 00-2-2zm0 12H3V9h18v10zM21 5H3V3h18v2z" />
            </svg>
          </button>
        </div>

        {/* Barcode Area */}
        <div className="bg-white p-8">
          <div className="flex flex-col items-center">
            <canvas ref={canvasRef} className="max-w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
