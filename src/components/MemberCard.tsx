"use client";

import { useState, useEffect, useRef } from "react";
import type { Member } from "@/lib/types";
import PDF417 from "pdf417-generator";

interface MemberCardProps {
  member: Member;
}

export function MemberCard({ member }: MemberCardProps) {
  const [showBarcode, setShowBarcode] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const statusColors = {
    active: "bg-green-500",
    alert: "bg-yellow-500",
    suspended: "bg-red-500",
    unknown: "bg-zinc-400",
  };

  const statusLabels = {
    active: "Active",
    alert: "Alert",
    suspended: "Suspended",
    unknown: "Unknown",
  };

  // Use decoded barcode value (zero-padded) if available, otherwise fall back to member number
  const barcodeData = member.barcodeValue || member.memberNumber;

  useEffect(() => {
    if (canvasRef.current && barcodeData && showBarcode) {
      PDF417.draw(barcodeData, canvasRef.current, 3, -1, 2);
    }
  }, [barcodeData, showBarcode]);

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-2xl shadow-xl overflow-hidden">
        {/* Card Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white/80 text-sm font-medium">
                Park Slope Food Coop
              </h2>
              <p className="text-white text-xl font-bold mt-1">{member.name}</p>
            </div>
            <div
              className={`${statusColors[member.status]} px-3 py-1 rounded-full`}
            >
              <span className="text-white text-xs font-semibold">
                {statusLabels[member.status]}
              </span>
            </div>
          </div>
        </div>

        {/* Member Number */}
        <div className="px-6 pb-4">
          <p className="text-white/60 text-xs">Member Number</p>
          <p className="text-white text-3xl font-mono font-bold tracking-wider">
            {member.memberNumber || "------"}
          </p>
        </div>

        {/* Barcode Area */}
        <div
          className="bg-white p-4 cursor-pointer"
          onClick={() => setShowBarcode(!showBarcode)}
        >
          {showBarcode && barcodeData ? (
            <div className="flex flex-col items-center">
              <canvas ref={canvasRef} className="max-w-full" />
              <p className="text-zinc-600 text-sm font-mono mt-2">
                {barcodeData}
              </p>
            </div>
          ) : (
            <p className="text-center text-zinc-400 text-sm">
              Tap to show barcode
            </p>
          )}
        </div>
      </div>

      {/* Add to Wallet Button */}
      <button
        className="mt-4 w-full bg-black dark:bg-white text-white dark:text-black py-3 px-6 rounded-xl font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
        onClick={() => alert("Wallet integration coming soon!")}
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M21 7H3a2 2 0 00-2 2v10a2 2 0 002 2h18a2 2 0 002-2V9a2 2 0 00-2-2zm0 12H3V9h18v10zM21 5H3V3h18v2z" />
        </svg>
        Add to Wallet
      </button>
    </div>
  );
}
