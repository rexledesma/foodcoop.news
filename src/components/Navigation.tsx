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
      return <span className="text-xl md:text-lg">🧭</span>;
    case "carrot":
      return <span className="text-xl md:text-lg">🥕</span>;
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
    <nav className="fixed top-0 left-0 right-0 bg-white/15 dark:bg-zinc-900/15 backdrop-blur-md safe-area-pt z-40">
      <div className="flex justify-between items-center h-16 md:h-14 max-w-3xl mx-auto md:gap-2 px-4">
        <div className="flex justify-start md:justify-center items-center md:gap-2 -ml-2 md:-ml-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-row items-center justify-center gap-2 px-2 py-2 md:px-4 rounded-lg transition-colors ${
                  isActive
                    ? "text-black dark:text-white"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white"
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

        <div className="flex items-center relative" ref={dropdownRef}>
          {isPending ? (
            <div className="w-8 h-8 md:w-auto md:h-auto md:px-4 md:py-2" />
          ) : session?.user ? (
            <>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center justify-center w-10 h-10 rounded-full transition-colors hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50"
              >
                <span className="text-xl">🥕</span>
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
