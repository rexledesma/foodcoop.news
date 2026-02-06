'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useSession, signOut } from '@/lib/auth-client';

const navItems = [
  { href: '/discover', label: 'Discover', icon: 'compass' },
  { href: '/produce', label: 'Produce', icon: 'produce' },
  {
    href: '/integrations',
    label: 'Integrations',
    icon: 'gear',
  },
];

function NavIcon({ icon }: { icon: string }) {
  switch (icon) {
    case 'compass':
      return <span className="text-xl md:text-lg">🧭</span>;
    case 'produce':
      return <span className="text-xl md:text-lg">🥬</span>;
    case 'carrot':
      return <span className="text-xl md:text-lg">🥕</span>;
    case 'gear':
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

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/login';
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="safe-area-pt fixed top-0 right-0 left-0 z-40 bg-white/15 backdrop-blur-md dark:bg-zinc-900/15">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 md:h-14 md:gap-2">
        <div className="-ml-2 flex items-center justify-start md:-ml-4 md:justify-center md:gap-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-row items-center justify-center gap-2 rounded-lg px-2 py-2 transition-colors md:px-4 ${
                  isActive
                    ? 'text-black dark:text-white'
                    : 'text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white'
                }`}
              >
                <NavIcon icon={item.icon} />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="relative flex items-center gap-2" ref={dropdownRef}>
          {isPending ? (
            <div className="h-8 w-8 md:h-auto md:w-auto md:px-4 md:py-2" />
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
                <div className="absolute top-full right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                  <div className="border-b border-zinc-200 p-4 dark:border-zinc-700">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      {memberProfile?.memberName || session.user.name}
                    </p>
                    {memberProfile?.memberId && (
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        Member ID: <span className="font-mono">{memberProfile.memberId}</span>
                      </p>
                    )}
                    <p className="mt-1 truncate text-sm text-zinc-500 dark:text-zinc-400">
                      {session.user.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full px-4 py-3 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </>
          ) : (
            <Link
              href="/login"
              className={`flex flex-row items-center justify-center gap-2 rounded-lg px-2 py-2 transition-colors md:px-4 ${
                pathname === '/login'
                  ? 'text-black dark:text-white'
                  : 'text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              <NavIcon icon="carrot" />
              <span className="hidden text-sm font-medium md:inline">Sign In</span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
