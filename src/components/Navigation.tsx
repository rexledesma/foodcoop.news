"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserMenu } from "./UserMenu";

const navItems = [
  { href: "/", label: "Card", icon: "credit-card" },
  { href: "/produce", label: "Produce", icon: "leaf" },
  { href: "/shifts", label: "Shifts", icon: "calendar" },
  { href: "/feed", label: "Feed", icon: "rss" },
];

function NavIcon({ icon }: { icon: string }) {
  switch (icon) {
    case "credit-card":
      return (
        <svg
          className="w-6 h-6 md:w-5 md:h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <rect x="2" y="5" width="20" height="14" rx="2" strokeWidth="2" />
          <line x1="2" y1="10" x2="22" y2="10" strokeWidth="2" />
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
            d="M12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5L12 22l8.7-5c.8-1.5 1.3-3.2 1.3-5 0-5.5-4.5-10-10-10z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 2v20"
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
    case "rss":
      return (
        <svg
          className="w-6 h-6 md:w-5 md:h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <circle cx="6" cy="18" r="2" strokeWidth="2" fill="currentColor" />
          <path
            strokeLinecap="round"
            strokeWidth="2"
            d="M4 4a16 16 0 0 1 16 16"
          />
          <path
            strokeLinecap="round"
            strokeWidth="2"
            d="M4 11a9 9 0 0 1 9 9"
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
                <span className="text-xs md:text-sm mt-1 md:mt-0 font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
