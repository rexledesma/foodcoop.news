"use client";

import { useRef } from "react";
import type { CSSProperties } from "react";

interface AppleWalletCardProps {
  memberName: string;
  memberId: string;
  onMemberNameChange: (value: string) => void;
  onMemberIdChange: (value: string) => void;
}

export function AppleWalletCard({
  memberName,
  memberId,
  onMemberNameChange,
  onMemberIdChange,
}: AppleWalletCardProps) {
  const shineRef = useRef<HTMLDivElement>(null);
  const passBackground = "rgb(255, 246, 220)";
  const passForeground = "rgb(51, 51, 51)";
  const passForegroundMuted = "rgba(51, 51, 51, 0.6)";
  const passForegroundSoft = "rgba(51, 51, 51, 0.35)";

  return (
    <div className="w-full max-w-sm" style={{ perspective: "1000px" }}>
      {/* Pass Preview - mimics iOS storeCard appearance */}
      <div
        className="relative w-full aspect-[1.586/1] rounded-2xl overflow-hidden shadow-xl transition-transform duration-300 ease-out hover:shadow-2xl"
        style={{
          backgroundColor: passBackground,
          backgroundImage: "url('/assets/coop-strip.png')",
          backgroundPosition: "center 12%",
          backgroundRepeat: "no-repeat",
          backgroundSize: "20% auto",
          transformStyle: "preserve-3d",
        }}
        role="img"
        aria-label="Apple Wallet member card preview"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const centerX = rect.width / 2;
          const centerY = rect.height / 2;
          const rotateX = ((y - centerY) / centerY) * -8;
          const rotateY = ((x - centerX) / centerX) * 8;
          e.currentTarget.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;

          // Update shine position
          if (shineRef.current) {
            shineRef.current.style.opacity = "1";
            shineRef.current.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 50%)`;
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "rotateX(0deg) rotateY(0deg)";
          if (shineRef.current) {
            shineRef.current.style.opacity = "0";
          }
        }}
      >
        {/* Shine overlay */}
        <div
          ref={shineRef}
          className="absolute inset-0 pointer-events-none transition-opacity duration-300"
          style={{ opacity: 0 }}
        />
        {/* Header with organization name */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/coop-padded.png"
              alt="Park Slope Food Coop"
              className="h-7 w-auto"
            />
          </div>
        </div>

        {/* Primary field - Member name (editable) */}
        <div className="absolute top-1/3 left-4 right-4">
          <label
            htmlFor="cardMemberName"
            className="block text-[10px] uppercase tracking-wider"
            style={{ color: passForegroundMuted }}
          >
            MEMBER
          </label>
          <div className="relative group">
            <input
              type="text"
              id="cardMemberName"
              value={memberName}
              onChange={(e) => onMemberNameChange(e.target.value)}
              placeholder="Your Name"
              className="w-full bg-transparent border-b border-dashed text-xl font-semibold focus:outline-none rounded-t px-1 py-0.5 transition-colors placeholder:text-zinc-400"
              style={{
                color: passForeground,
                borderColor: passForegroundSoft,
              }}
            />
            <PencilIcon
              className="absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors pointer-events-none"
              style={{ color: passForegroundSoft }}
            />
          </div>
        </div>

        {/* Secondary field - Member ID (editable) */}
        <div className="absolute bottom-[18%] left-4 right-4">
          <label
            htmlFor="cardMemberId"
            className="block text-[10px] uppercase tracking-wider"
            style={{ color: passForegroundMuted }}
          >
            MEMBER ID
          </label>
          <div className="relative group w-fit">
            <input
              type="text"
              id="cardMemberId"
              inputMode="numeric"
              value={memberId}
              onChange={(e) => onMemberIdChange(e.target.value)}
              placeholder="000000"
              className="w-32 bg-transparent border-b border-dashed text-xl font-semibold focus:outline-none rounded-t px-1 py-0.5 transition-colors placeholder:text-zinc-400"
              style={{
                color: passForeground,
                borderColor: passForegroundSoft,
              }}
            />
            <PencilIcon
              className="absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors pointer-events-none"
              style={{ color: passForegroundSoft }}
            />
          </div>
        </div>

      </div>
    </div>
  );
}

function PencilIcon({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}
