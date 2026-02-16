'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useSession, signOut } from '@/lib/auth-client';
import SvelteMount from '@/components/SvelteMount';
import NavigationView from '@/components/Navigation.svelte';
import { useScrollVisibility } from '@/components/ScrollVisibilityProvider';
import { withNextParam } from '@/lib/auth-redirect';

type NavigationClientState = {
  pathname: string;
  loginHref: string;
  showSticky: boolean;
  isPending: boolean;
  isAuthenticated: boolean;
  isDropdownOpen: boolean;
  memberName: string;
  memberId: string;
  userEmail: string;
  onToggleDropdown: () => void;
  onCloseDropdown: () => void;
  onSignOut: () => Promise<void>;
};

export function Navigation() {
  const pathname = usePathname();
  const { data: session, isPending } = useSession();
  const memberProfile = useQuery(api.memberProfiles.getMemberProfile);
  const { showSticky } = useScrollVisibility();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const channelRef = useRef<string>(`navigation-${Math.random().toString(36).slice(2)}`);
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

  const handleSignOut = useCallback(async () => {
    await signOut();
    window.location.href = loginHref;
  }, [loginHref]);

  const handleToggleDropdown = useCallback(() => {
    setIsDropdownOpen((current) => !current);
  }, []);

  const handleCloseDropdown = useCallback(() => {
    setIsDropdownOpen(false);
  }, []);

  const state = useMemo<NavigationClientState>(
    () => ({
      pathname,
      loginHref,
      showSticky,
      isPending,
      isAuthenticated: Boolean(session?.user),
      isDropdownOpen,
      memberName: memberProfile?.memberName || session?.user.name || '',
      memberId: memberProfile?.memberId || '',
      userEmail: session?.user.email || '',
      onToggleDropdown: handleToggleDropdown,
      onCloseDropdown: handleCloseDropdown,
      onSignOut: handleSignOut,
    }),
    [
      pathname,
      loginHref,
      showSticky,
      isPending,
      session?.user,
      isDropdownOpen,
      memberProfile?.memberName,
      memberProfile?.memberId,
      handleToggleDropdown,
      handleCloseDropdown,
      handleSignOut,
    ],
  );

  const initialStateRef = useRef(state);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(`navigation-state:update:${channelRef.current}`, {
        detail: state,
      }),
    );
  }, [state]);

  const props = useMemo(
    () => ({
      channel: channelRef.current,
      initialState: initialStateRef.current,
    }),
    [],
  );

  return <SvelteMount component={NavigationView} props={props} />;
}
