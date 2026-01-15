"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserMenu } from "./UserMenu";

const navItems = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/produce", label: "Produce", icon: "leaf" },
  { href: "/shifts", label: "Shifts", icon: "calendar" },
  { href: "/feed", label: "Discover", icon: "compass" },
];

function NavIcon({ icon }: { icon: string }) {
  switch (icon) {
    case "home":
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
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      );
    case "leaf":
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
            d="M6 21s-2-6 2-12c3-4 8-5 12-3 1 1 2 3 1 5-1 3-4 5-8 5-3 0-5-1-6-3-1 3 0 6-1 8z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M11 11c2-2 5-3 7-2"
          />
        </svg>
      );
    case "calendar":
      return (
        <svg
          className="w-6 h-6 md:w-5 md:h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="2" />
          <line x1="16" y1="2" x2="16" y2="6" strokeWidth="2" />
          <line x1="8" y1="2" x2="8" y2="6" strokeWidth="2" />
          <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2" />
        </svg>
      );
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
    default:
      return null;
  }
}

export function Navigation() {
  const pathname = usePathname();

  return (
    <>
      {/* User menu - fixed top right on all screens */}
      <div className="fixed top-4 right-4 z-50 md:top-2 md:right-4">
        <UserMenu />
      </div>

      <nav className="fixed bottom-0 md:bottom-auto md:top-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t md:border-t-0 md:border-b border-zinc-200 dark:border-zinc-800 safe-area-pb md:safe-area-pb-0 md:safe-area-pt z-40">
        <div className="flex justify-around md:justify-center items-center h-16 md:h-14 max-w-lg md:max-w-none mx-auto md:gap-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col md:flex-row items-center justify-center md:gap-2 flex-1 md:flex-initial h-full md:h-auto md:px-4 md:py-2 md:rounded-lg transition-colors ${
                  isActive
                    ? "text-green-600 dark:text-green-400"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
              >
                <NavIcon icon={item.icon} />
                <span className="text-xs md:text-sm mt-1 md:mt-0 font-medium">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
