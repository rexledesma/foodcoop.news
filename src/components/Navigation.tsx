'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useSession, signOut } from '@/lib/auth-client';
import { useScrollVisibility } from '@/components/ScrollVisibilityProvider';
import { withNextParam } from '@/lib/auth-redirect';

const navItems = [
  { href: '/discover', label: 'Discover', icon: 'compass' },
  { href: '/produce', label: 'Produce', icon: 'produce' },
  {
    href: '/integrations',
    label: 'Integrations',
    icon: 'gear',
  },
];

const aboutItem = { href: '/about', label: 'About', icon: 'info' };

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
    case 'info':
      return <span className="text-xl md:text-lg">ℹ️</span>;
    default:
      return null;
  }
}

export function Navigation() {
  const pathname = usePathname();
  const { data: session, isPending } = useSession();
  const memberProfile = useQuery(api.memberProfiles.getMemberProfile);
  const { showSticky } = useScrollVisibility();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const desktopDropdownRef = useRef<HTMLDivElement>(null);
  const mobileDropdownRef = useRef<HTMLDivElement>(null);
  const loginHref = withNextParam('/login', pathname);

  useEffect(() => {
    if (!session?.user || typeof window === 'undefined') {
      return;
    }

    if (localStorage.getItem('produce-favorites') === null) {
      return;
    }

    localStorage.removeItem('produce-favorites');
    window.dispatchEvent(new Event('produce-favorites'));
  }, [session?.user]);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = loginHref;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const inDesktop = desktopDropdownRef.current?.contains(target);
      const inMobile = mobileDropdownRef.current?.contains(target);
      if (!inDesktop && !inMobile) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav
      className={`safe-area-pt fixed top-0 right-0 left-0 z-40 bg-gradient-to-b from-[#e6f3fc] via-[#e6f9f0] to-white transition-opacity duration-300 ease-in-out motion-reduce:transition-none ${
        showSticky ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 md:h-14 md:gap-2">
        <div className="-ml-2 flex items-center justify-start md:-ml-4 md:justify-center md:gap-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-row items-center justify-center gap-2 rounded-lg px-2 py-2 transition-colors md:px-4 ${
                  isActive ? 'text-black' : 'text-zinc-500 hover:text-black'
                }`}
              >
                <NavIcon icon={item.icon} />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
          {/* About + Account/Sign In: hidden on mobile, shown inline on desktop */}
          <Link
            href={aboutItem.href}
            className={`hidden flex-row items-center justify-center gap-2 rounded-lg px-2 py-2 transition-colors md:flex md:px-4 ${
              pathname === aboutItem.href ? 'text-black' : 'text-zinc-500 hover:text-black'
            }`}
          >
            <NavIcon icon={aboutItem.icon} />
            <span className="text-sm font-medium">{aboutItem.label}</span>
          </Link>
        </div>
        {!isPending && (
          <div className="relative hidden md:block" ref={desktopDropdownRef}>
            {session?.user ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className={`flex flex-row items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    isDropdownOpen ? 'text-black' : 'text-zinc-500 hover:text-black'
                  }`}
                >
                  <NavIcon icon="carrot" />
                  <span>Account</span>
                </button>
                {isDropdownOpen && (
                  <div className="absolute top-full right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
                    <div className="border-b border-zinc-200 p-4">
                      <p className="font-medium text-zinc-900">
                        {memberProfile?.memberName || session.user.name}
                      </p>
                      {memberProfile?.memberId && (
                        <p className="mt-1 text-sm text-zinc-500">
                          Member ID: <span className="font-mono">{memberProfile.memberId}</span>
                        </p>
                      )}
                      <p className="mt-1 truncate text-sm text-zinc-500">{session.user.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="w-full px-4 py-3 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </>
            ) : (
              <Link
                href={loginHref}
                className={`flex flex-row items-center justify-center gap-2 rounded-lg px-4 py-2 transition-colors ${
                  pathname === '/login' ? 'text-black' : 'text-zinc-500 hover:text-black'
                }`}
              >
                <NavIcon icon="carrot" />
                <span className="text-sm font-medium">Sign In</span>
              </Link>
            )}
          </div>
        )}
      </div>
      <div className="mx-auto -ml-2 flex max-w-3xl items-center px-4 pb-2 md:hidden">
        <Link
          href={aboutItem.href}
          className={`inline-flex flex-row items-center justify-center gap-2 rounded-lg px-2 py-1 transition-colors ${
            pathname === aboutItem.href ? 'text-black' : 'text-zinc-500 hover:text-black'
          }`}
        >
          <NavIcon icon={aboutItem.icon} />
          <span className="text-sm font-medium">{aboutItem.label}</span>
        </Link>
        {!isPending &&
          (session?.user ? (
            <div className="relative" ref={mobileDropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`flex flex-row items-center justify-center gap-2 rounded-lg px-2 py-1 text-sm font-medium transition-colors ${
                  isDropdownOpen ? 'text-black' : 'text-zinc-500 hover:text-black'
                }`}
              >
                <NavIcon icon="carrot" />
                <span>Account</span>
              </button>
              {isDropdownOpen && (
                <div className="absolute top-full left-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
                  <div className="border-b border-zinc-200 p-4">
                    <p className="font-medium text-zinc-900">
                      {memberProfile?.memberName || session.user.name}
                    </p>
                    {memberProfile?.memberId && (
                      <p className="mt-1 text-sm text-zinc-500">
                        Member ID: <span className="font-mono">{memberProfile.memberId}</span>
                      </p>
                    )}
                    <p className="mt-1 truncate text-sm text-zinc-500">{session.user.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full px-4 py-3 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href={loginHref}
              className={`flex flex-row items-center justify-center gap-2 rounded-lg px-2 py-1 transition-colors ${
                pathname === '/login' ? 'text-black' : 'text-zinc-500 hover:text-black'
              }`}
            >
              <NavIcon icon="carrot" />
              <span className="text-sm font-medium">Sign In</span>
            </Link>
          ))}
      </div>
    </nav>
  );
}
