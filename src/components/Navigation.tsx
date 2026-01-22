"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
    default:
      return null;
  }
}

export function Navigation() {
  const pathname = usePathname();

  return (
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
  );
}
