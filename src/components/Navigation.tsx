"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useSession, signOut } from "@/lib/auth-client";

const navItems = [{ href: "/discover", label: "Discover", icon: "compass" }];

function NavIcon({ icon }: { icon: string }) {
  switch (icon) {
    case "compass":
      return (
        <svg
          className="w-6 h-6 md:w-5 md:h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="10" strokeWidth="2" />
          <polygon
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1"
            points="12,2 14,12 12,22 10,12"
            transform="rotate(45 12 12)"
          />
        </svg>
      );
    case "user":
      return (
        <svg
          className="w-6 h-6 md:w-5 md:h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      );
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
    <nav className="fixed bottom-0 md:bottom-auto md:top-0 left-0 right-0 bg-white/15 dark:bg-zinc-900/15 backdrop-blur-md safe-area-pb md:safe-area-pb-0 md:safe-area-pt z-40">
      <div className="flex justify-around md:justify-between items-center h-16 md:h-14 max-w-lg md:max-w-4xl mx-auto md:gap-2 md:px-4">
        <div className="flex justify-around md:justify-center items-center flex-1 md:flex-initial md:gap-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col md:flex-row items-center justify-center md:gap-2 flex-1 md:flex-initial h-full md:h-auto md:px-4 md:py-2 md:rounded-lg transition-colors text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white"
              >
                <NavIcon icon={item.icon} />
                <span className="text-xs md:text-sm mt-1 md:mt-0 font-medium">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="flex items-center relative" ref={dropdownRef}>
          {isPending ? (
            <div className="w-8 h-8 md:w-auto md:h-auto md:px-4 md:py-2" />
          ) : session?.user ? (
            <>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex flex-col md:flex-row items-center justify-center md:gap-2 flex-1 md:flex-initial h-full md:h-auto md:px-4 md:py-2 md:rounded-lg transition-colors text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white"
              >
                <NavIcon icon="user" />
                <span className="text-xs md:text-sm mt-1 md:mt-0 font-medium hidden md:inline">
                  {memberProfile?.memberName || session.user.name || "Profile"}
                </span>
              </button>

              {isDropdownOpen && (
                <div className="absolute bottom-full md:bottom-auto md:top-full right-0 mb-2 md:mb-0 md:mt-2 w-64 bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden z-50">
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
                  <Link
                    href="/settings"
                    onClick={() => setIsDropdownOpen(false)}
                    className="block w-full px-4 py-3 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Settings
                  </Link>
                  <button
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
              className={`flex flex-col md:flex-row items-center justify-center md:gap-2 flex-1 md:flex-initial h-full md:h-auto md:px-4 md:py-2 md:rounded-lg transition-colors ${
                pathname === "/login"
                  ? "text-black dark:text-white"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white"
              }`}
            >
              <NavIcon icon="user" />
              <span className="text-xs md:text-sm mt-1 md:mt-0 font-medium">
                Sign In
              </span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
