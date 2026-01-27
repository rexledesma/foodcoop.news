"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useSession, signOut } from "@/lib/auth-client";

const navItems = [
  { href: "/discover", label: "Discover", icon: "compass" },
  {
    href: "/integrations",
    label: "Integrations",
    icon: "gear",
    requiresAuth: true,
  },
];

type CoopStatus = "open" | "closing-soon" | "closed";

function getCoopStatus(date: Date): CoopStatus {
  // Get current time in EST/EDT
  const estOptions = { timeZone: "America/New_York" };
  const estString = date.toLocaleString("en-US", estOptions);
  const estDate = new Date(estString);

  const dayOfWeek = estDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const hour = estDate.getHours();

  // Sunday: 8am - 8pm, closing soon at 7pm
  if (dayOfWeek === 0) {
    if (hour >= 19 && hour < 20) return "closing-soon";
    if (hour >= 8 && hour < 20) return "open";
    return "closed";
  }

  // Monday - Saturday: 8am - 9pm, closing soon at 8pm
  if (hour >= 20 && hour < 21) return "closing-soon";
  if (hour >= 8 && hour < 21) return "open";
  return "closed";
}

function formatTimeEST(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
}

function NavIcon({ icon }: { icon: string }) {
  switch (icon) {
    case "compass":
      return <span className="text-xl md:text-lg">🧭</span>;
    case "carrot":
      return <span className="text-xl md:text-lg">🥕</span>;
    case "gear":
      return <span className="text-xl md:text-lg">⚙️</span>;
    default:
      return null;
  }
}

export function Navigation() {
  const pathname = usePathname();
  const { data: session, isPending } = useSession();
  const memberProfile = useQuery(api.memberProfiles.getMemberProfile);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [timeDisplay, setTimeDisplay] = useState<{
    time: string;
    status: CoopStatus;
  } | null>(null);

  // Update time display every second
  useEffect(() => {
    function updateTime() {
      const now = new Date();
      setTimeDisplay({
        time: formatTimeEST(now),
        status: getCoopStatus(now),
      });
    }

    updateTime(); // Initial update
    const interval = setInterval(updateTime, 1000); // Update every second for smooth transitions

    return () => clearInterval(interval);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/login";
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 bg-white/15 dark:bg-zinc-900/15 backdrop-blur-md safe-area-pt z-40">
      <div className="flex justify-between items-center h-16 md:h-14 max-w-3xl mx-auto md:gap-2 px-4">
        <div className="flex justify-start md:justify-center items-center md:gap-2 -ml-2 md:-ml-4">
          {navItems.map((item) => {
            const isDisabled = item.requiresAuth && !session?.user;
            const isActive = !isDisabled && pathname === item.href;
            const href = isDisabled
              ? "/signup?reason=integrations"
              : item.href;
            return (
              <Link
                key={item.href}
                href={href}
                aria-disabled={isDisabled}
                className={`flex flex-row items-center justify-center gap-2 px-2 py-2 md:px-4 rounded-lg transition-colors ${
                  isActive
                    ? "text-black dark:text-white"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white"
                } ${
                  isDisabled
                    ? "opacity-60 hover:text-zinc-500 dark:hover:text-zinc-400"
                    : ""
                }`}
              >
                <NavIcon icon={item.icon} />
                <span className="hidden md:inline text-sm font-medium">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2 relative" ref={dropdownRef}>
          {timeDisplay && (
            <div className="relative group">
              <div className="text-sm text-zinc-500 dark:text-zinc-400 cursor-default">
                <span>
                  {timeDisplay.status === "open" && "✨"}
                  {timeDisplay.status === "closing-soon" && "⏳"}
                  {timeDisplay.status === "closed" && "🔒"}
                </span>{" "}
                <span>{timeDisplay.time}</span>
              </div>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 bg-zinc-800 dark:bg-zinc-700 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                {timeDisplay.status === "open" && "The Coop is open"}
                {timeDisplay.status === "closing-soon" &&
                  "The Coop closes soon"}
                {timeDisplay.status === "closed" && "The Coop is closed"}
              </div>
            </div>
          )}
          {isPending ? (
            <div className="w-8 h-8 md:w-auto md:h-auto md:px-4 md:py-2" />
          ) : session?.user ? (
            <>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-2 text-sm font-medium text-zinc-700 transition-colors hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
              >
                <span className="text-xl">🥕</span>
                <span className="hidden sm:inline">Account</span>
              </button>

              {isDropdownOpen && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden z-50">
                  <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      {memberProfile?.memberName || session.user.name}
                    </p>
                    {memberProfile?.memberId && (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Member ID:{" "}
                        <span className="font-mono">
                          {memberProfile.memberId}
                        </span>
                      </p>
                    )}
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 truncate">
                      {session.user.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full px-4 py-3 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </>
          ) : (
            <Link
              href="/login"
              className={`flex flex-row items-center justify-center gap-2 px-2 py-2 md:px-4 rounded-lg transition-colors ${
                pathname === "/login"
                  ? "text-black dark:text-white"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white"
              }`}
            >
              <NavIcon icon="carrot" />
              <span className="hidden md:inline text-sm font-medium">
                Sign In
              </span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
