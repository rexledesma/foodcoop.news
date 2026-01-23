"use client";

import { useRef } from "react";

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

  return (
    <div className="w-full max-w-sm" style={{ perspective: "1000px" }}>
      {/* Pass Preview - mimics iOS storeCard appearance */}
      <div
        className="relative w-full aspect-[1.586/1] rounded-2xl overflow-hidden shadow-xl transition-transform duration-300 ease-out hover:shadow-2xl"
        style={{
          backgroundColor: "rgb(22, 101, 52)",
          transformStyle: "preserve-3d",
        }}
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
          <div className="text-white/80 text-xs font-medium tracking-wide">
            PARK SLOPE FOOD COOP
          </div>
        </div>

        {/* Primary field - Member name (editable) */}
        <div className="absolute top-1/3 left-4 right-4">
          <label
            htmlFor="cardMemberName"
            className="block text-white/60 text-[10px] uppercase tracking-wider"
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
              className="w-full bg-white/0 hover:bg-white/10 focus:bg-white/10 border-b border-dashed border-white/30 hover:border-white/50 focus:border-white/60 text-white text-xl font-semibold placeholder:text-white/40 focus:outline-none rounded-t px-1 py-0.5 transition-colors"
            />
            <PencilIcon className="absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-hover:text-white/60 transition-colors pointer-events-none" />
          </div>
        </div>

        {/* Secondary field - Member ID (editable) */}
        <div className="absolute bottom-16 left-4 right-4">
          <label
            htmlFor="cardMemberId"
            className="block text-white/60 text-[10px] uppercase tracking-wider"
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
              className="w-32 bg-white/0 hover:bg-white/10 focus:bg-white/10 border-b border-dashed border-white/30 hover:border-white/50 focus:border-white/60 text-white font-mono text-lg placeholder:text-white/40 focus:outline-none rounded-t px-1 py-0.5 transition-colors"
            />
            <PencilIcon className="absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-hover:text-white/60 transition-colors pointer-events-none" />
          </div>
        </div>

      </div>
    </div>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}
