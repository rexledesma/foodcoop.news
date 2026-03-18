<script lang="ts">
  import { goto } from '$app/navigation';
  import { env as publicEnv } from '$env/dynamic/public';
  import { onMount } from 'svelte';
  import Integrations from '@/components/integrations/Integrations.svelte';
  import { withNextParam } from '@/lib/auth-redirect';
  import {
    extractSubscriptionKeys,
    getExistingSubscription,
    isPushSupported,
    registerServiceWorker,
    subscribeToPush,
    unsubscribeFromPush,
  } from '@/lib/push-notifications';
  import { getCurrentStickyVisibility } from '@/lib/sticky-visibility';

  const channel = `integrations-${Math.random().toString(36).slice(2)}`;
  const CALENDAR_PROXY_PATH = '/api/calendar';
  const DRAFT_STORAGE_KEY = 'integrations:draft';
  const NOTIFICATIONS_ALLOWED_EMAILS = (publicEnv.PUBLIC_NOTIFICATIONS_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((email: string) : string => email.trim())
    .filter(Boolean);
  const SHIFT_JOB_OPTIONS = [
    '🚽 Bathroom',
    '🍺 Beer',
    '🧼 Bins',
    '🍞 Bread Stocking',
    '🫘 Bulk Lifting',
    '🛒 Cart Return',
    '🧽 Case Maintenance',
    '💵 Cashier',
    '💳 Checkout',
    '🍛 CHIPS Food Drive',
    'CHiPS Gala',
    '🏝 Cleaning',
    '🥛 Dairy Lifting',
    '🚛 Delivery Support',
    '💰 Drawer',
    '⌨️ Enrollment Data Entry',
    '📃 Enrollment',
    '🎟 Entrance/Greeter',
    '🥫 Flex',
    '🍿 Food Processing TL ',
    '🍿 Food Processing ',
    '👀 Front End Support',
    '🗳️ General Meeting',
    '🧴 Health & Beauty',
    '🖥 Inventory Data',
    '📋 Inventory',
    '🍀 Inventory: Produce',
    '🚚 Lifting',
    '🍖 Meat Processing & Lifting',
    '📗 Office',
    '🥬 Produce Processing',
    '🥦 Producer',
    '📦 Receiving: Team Leader',
    '🛠 Repairs',
    '🖨 Scan Invoices',
    '🧺 Set-up & Equipment Cleaning',
    '🗂 Sort & Collate',
    'Soup Cleaning',
    '🍲 Soup: Food Services',
    '✍️ Soup: Guest Services- Outdoor',
    '🙂 Soup: Reception',
    'Special Project: Data Entry',
    '📦 Stocking',
    '🦃 Turkey',
    '🍬 Vitamins',
    '🧾 Vouchers',
  ];

  type SessionData = {
    user: { email: string; name?: string };
  } | null;

  type MemberProfile = {
    memberName: string;
    memberId: string;
    calendarId: string;
    jobFilters: string[];
  } | null;

  type Toast = {
    id: number;
    variant: 'success' | 'error' | 'warning';
    message: string;
    visible: boolean;
  };


  let session: SessionData = null;
  let profile: MemberProfile = null;

  function normalizeJobSortKey(job: string) : string {
    return job
      .replace(/^\p{Extended_Pictographic}+\s*/gu, '')
      .toLowerCase()
      .trim();
  }

  function sortJobs(jobs: string[]) : string[] {
    return [...jobs].sort((a, b) : number => normalizeJobSortKey(a).localeCompare(normalizeJobSortKey(b)));
  }

  let state = {
    isInitialLoading: true,
    showSticky: getCurrentStickyVisibility(),
    sessionPending: true,
    isSignedIn: false,
    signupHref: withNextParam('/signup', '/integrations'),
    fullName: '',
    memberId: '',
    displayFullName: '',
    isSaving: false,
    isGeneratingPass: false,
    isGeneratingGooglePass: false,
    calendarId: '',
    isCalendarModalOpen: false,
    calendarDisplayUrl: '',
    googleCalendarUrl: '',
    outlookCalendarUrl: '',
    selectedJobs: [] as string[],
    jobSearch: '',
    isJobDropdownOpen: false,
    highlightedJobIndex: 0,
    filteredJobOptions: SHIFT_JOB_OPTIONS,
    pushSupported: false,
    canManageNotifications: false,
    pushEnabled: false,
    pushLoading: false,
    isSendingTest: false,
    toasts: [] as Toast[],
    onMemberNameChange: (value: string) : void => {
      state = { ...state, fullName: value, displayFullName: value.trim() };
      maybeSaveDraft();
      dispatchState();
    },
    onMemberIdChange: (value: string) : void => {
      state = { ...state, memberId: value.replace(/\D/g, '') };
      maybeSaveDraft();
      dispatchState();
    },
    onSave: async () : Promise<void> => saveProfile(),
    onAddToWallet: async () : Promise<void> => addToWallet(),
    onAddToGoogleWallet: async () : Promise<void> => addToGoogleWallet(),
    onOpenCalendarModal: () : void => {
      if (!requireAuth()) {return;}
      state = { ...state, isCalendarModalOpen: true };
      dispatchState();
    },
    onCloseCalendarModal: () : void => {
      state = { ...state, isCalendarModalOpen: false };
      dispatchState();
    },
    onCopyCalendarUrl: async () : Promise<void> => copyCalendarUrl(),
    onJobSearchChange: (value: string) : void => {
      const filtered = value.trim()
        ? SHIFT_JOB_OPTIONS.filter((job) : boolean => job.toLowerCase().includes(value.toLowerCase()))
        : SHIFT_JOB_OPTIONS;
      state = {
        ...state,
        jobSearch: value,
        filteredJobOptions: filtered,
        isJobDropdownOpen: true,
        highlightedJobIndex: filtered.length === 0 ? -1 : 0,
      };
      dispatchState();
    },
    onJobSearchFocus: () : void => {
      state = { ...state, isJobDropdownOpen: true };
      dispatchState();
    },
    onJobSearchBlur: () : void => {
      window.setTimeout(() : void => {
        state = { ...state, isJobDropdownOpen: false };
        dispatchState();
      }, 150);
    },
    onJobSearchKeyDown: (event: KeyboardEvent) : void => handleJobKeydown(event),
    onToggleJob: (job: string) : Promise<void> => toggleJob(job),
    onRemoveJob: (job: string) : Promise<void> => removeJob(job),
    onHighlightJobIndex: (index: number) : void => {
      state = { ...state, highlightedJobIndex: index };
      dispatchState();
    },
    onTogglePush: async () : Promise<void> => togglePush(),
    onSendTestNotification: async () : Promise<void> => sendTestNotification(),
  };

  const initialState = state;

  function dispatchState() : void {
    window.dispatchEvent(new CustomEvent(`integrations-state:update:${channel}`, { detail: state }));
  }

  function loadDraft() : { fullName: string; memberId: string; selectedJobs: string[]; } | null {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) {return null;}
      return JSON.parse(raw) as { fullName: string; memberId: string; selectedJobs: string[] };
    } catch {
      return null;
    }
  }

  function saveDraft() : void {
    try {
      localStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({
          fullName: state.fullName,
          memberId: state.memberId,
          selectedJobs: state.selectedJobs,
        }),
      );
    } catch {
      // Ignore storage errors.
    }
  }

  function maybeSaveDraft() : void {
    if (!session) {
      saveDraft();
    }
  }

  function clearDraft() : void {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  }

  function getCalendarUrls(calendarId: string) : { calendarDisplayUrl: string; googleCalendarUrl: string; outlookCalendarUrl: string; } {
    const origin = window.location.origin;
    const path = `${CALENDAR_PROXY_PATH}/${calendarId}`;
    const display = `${origin}${path}`;
    return {
      calendarDisplayUrl: display,
      googleCalendarUrl: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(
        display.replace(/^https:\/\//, 'http://'),
      )}`,
      outlookCalendarUrl: `https://outlook.live.com/calendar/0/addcalendar?url=${encodeURIComponent(
        display.replace(/^https:\/\//, 'webcal://'),
      )}`,
    };
  }

  function pushToast(variant: Toast['variant'], message: string) : void {
    const id = Date.now();
    const toast: Toast = { id, variant, message, visible: false };
    state = { ...state, toasts: [...state.toasts, toast] };
    dispatchState();

    window.setTimeout(() : void => {
      state = {
        ...state,
        toasts: state.toasts.map((t) : Toast => (t.id === id ? { ...t, visible: true } : t)),
      };
      dispatchState();
    }, 10);

    window.setTimeout(() : void => {
      state = {
        ...state,
        toasts: state.toasts.map((t) : Toast => (t.id === id ? { ...t, visible: false } : t)),
      };
      dispatchState();
    }, 2500);

    window.setTimeout(() : void => {
      state = { ...state, toasts: state.toasts.filter((t) : boolean => t.id !== id) };
      dispatchState();
    }, 3000);
  }

  function requireAuth() : boolean {
    if (session?.user) {return true;}
    void goto(withNextParam('/signup', '/integrations'));
    return false;
  }

  async function fetchSession() : Promise<SessionData> {
    try {
      const response = await fetch('/api/auth/get-session');
      if (!response.ok) {return null;}
      return (await response.json()) as SessionData;
    } catch {
      return null;
    }
  }

  async function fetchProfile() : Promise<MemberProfile> {
    const response = await fetch('/api/me/profile');
    if (!response.ok) {return null;}
    const data = (await response.json()) as { profile: MemberProfile };
    return data.profile;
  }

  async function fetchPushSubscriptions() : Promise<{ endpoint: string; }[]> {
    const response = await fetch('/api/me/push-subscriptions');
    if (!response.ok) {return [];}
    const data = (await response.json()) as { subscriptions: { endpoint: string }[] };
    return data.subscriptions;
  }

  async function updateProfile(payload: {
    memberName?: string;
    memberId?: string;
    jobFilters?: string[];
  }) : Promise<MemberProfile> {
    const response = await fetch('/api/me/profile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error('Failed to update profile');
    }
    const data = (await response.json()) as { profile: MemberProfile };
    profile = data.profile;
    return profile;
  }

  function syncProfileToState() : void {
    if (!profile) {return;}
    const urls = getCalendarUrls(profile.calendarId);
    const sortedJobs = sortJobs(profile.jobFilters ?? []);
    state = {
      ...state,
      fullName: profile.memberName || '',
      memberId: profile.memberId || '',
      displayFullName: (profile.memberName || '').trim(),
      calendarId: profile.calendarId || '',
      selectedJobs: sortedJobs,
      ...urls,
    };
  }

  function handleJobKeydown(event: KeyboardEvent) : void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (state.filteredJobOptions.length === 0) {return;}
      state = {
        ...state,
        isJobDropdownOpen: true,
        highlightedJobIndex:
          state.highlightedJobIndex < state.filteredJobOptions.length - 1
            ? state.highlightedJobIndex + 1
            : 0,
      };
      dispatchState();
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (state.filteredJobOptions.length === 0) {return;}
      state = {
        ...state,
        isJobDropdownOpen: true,
        highlightedJobIndex:
          state.highlightedJobIndex > 0
            ? state.highlightedJobIndex - 1
            : state.filteredJobOptions.length - 1,
      };
      dispatchState();
      return;
    }

    if (event.key === 'Enter') {
      if (!state.isJobDropdownOpen) {
        state = { ...state, isJobDropdownOpen: true };
        dispatchState();
        return;
      }
      if (state.filteredJobOptions.length === 0) {return;}
      event.preventDefault();
      const job = state.filteredJobOptions[Math.max(0, state.highlightedJobIndex)];
      if (job) {
        toggleJob(job);
      }
      return;
    }

    if (event.key === 'Escape') {
      state = { ...state, isJobDropdownOpen: false };
      dispatchState();
    }
  }

  async function toggleJob(job: string) : Promise<void> {
    const nextJobs = state.selectedJobs.includes(job)
      ? state.selectedJobs.filter((j) : boolean => j !== job)
      : [...state.selectedJobs, job];
    state = { ...state, selectedJobs: nextJobs };
    maybeSaveDraft();
    dispatchState();

    if (session?.user) {
      try {
        await updateProfile({ jobFilters: nextJobs });
      } catch (error) {
        pushToast('error', error instanceof Error ? error.message : 'Failed to update shift filters');
      }
    }
  }

  async function removeJob(job: string) : Promise<void> {
    await toggleJob(job);
  }

  async function saveProfile() : Promise<void> {
    if (!requireAuth()) {return;}
    state = { ...state, isSaving: true };
    dispatchState();
    try {
      const trimmedMemberName = state.fullName.trim();
      await updateProfile({
        memberName: trimmedMemberName.length > 0 ? trimmedMemberName : ' ',
        memberId: state.memberId.trim(),
        jobFilters: state.selectedJobs,
      });
      pushToast('success', 'Profile successfully updated.');
    } catch (error) {
      pushToast('error', error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      state = { ...state, isSaving: false };
      dispatchState();
    }
  }

  async function addToWallet() : Promise<void> {
    if (!requireAuth()) {return;}
    state = { ...state, isGeneratingPass: true };
    dispatchState();
    try {
      await updateProfile({
        memberName: state.fullName.trim(),
        memberId: state.memberId.trim(),
      });
      const response = await fetch('/api/wallet/pass');
      if (!response.ok) {throw new Error('Failed to generate pass');}
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'psfc-member-card.pkpass';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      pushToast('success', 'Pass downloaded successfully.');
    } catch (error) {
      pushToast('error', error instanceof Error ? error.message : 'Failed to generate pass');
    } finally {
      state = { ...state, isGeneratingPass: false };
      dispatchState();
    }
  }

  async function addToGoogleWallet() : Promise<void> {
    if (!requireAuth()) {return;}
    state = { ...state, isGeneratingGooglePass: true };
    dispatchState();
    try {
      await updateProfile({
        memberName: state.fullName.trim(),
        memberId: state.memberId.trim(),
      });
      const response = await fetch('/api/wallet/google');
      if (!response.ok) {throw new Error('Failed to generate pass');}
      const data = (await response.json()) as { url: string };
      window.open(data.url, '_blank');
      pushToast('success', 'Opening Google Wallet...');
    } catch (error) {
      pushToast('error', error instanceof Error ? error.message : 'Failed to generate pass');
    } finally {
      state = { ...state, isGeneratingGooglePass: false };
      dispatchState();
    }
  }

  async function copyCalendarUrl() : Promise<void> {
    if (!requireAuth()) {return;}
    if (!state.calendarId) {
      pushToast('error', 'Create a calendar subscription first.');
      return;
    }
    try {
      await navigator.clipboard.writeText(state.calendarDisplayUrl);
      pushToast('success', 'Copied calendar URL to clipboard.');
    } catch {
      pushToast('error', 'Clipboard copy failed. Copy manually from the modal.');
    }
  }

  async function togglePush() : Promise<void> {
    if (!requireAuth()) {return;}
    state = { ...state, pushLoading: true };
    dispatchState();

    try {
      if (state.pushEnabled) {
        const existing = await getExistingSubscription();
        if (existing) {
          await fetch('/api/me/push-subscriptions', {
            method: 'DELETE',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ endpoint: existing.endpoint }),
          });
        }
        await unsubscribeFromPush();
        state = { ...state, pushEnabled: false };
        pushToast('success', 'Notifications disabled.');
      } else {
        const subscription = await subscribeToPush();
        const keys = extractSubscriptionKeys(subscription);
        const response = await fetch('/api/me/push-subscriptions', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(keys),
        });
        if (!response.ok) {throw new Error('Failed to enable notifications');}
        state = { ...state, pushEnabled: true };
        pushToast('success', 'Notifications enabled.');
      }
    } catch (error) {
      pushToast(
        'error',
        error instanceof Error ? error.message : 'Failed to update notification settings',
      );
    } finally {
      state = { ...state, pushLoading: false };
      dispatchState();
    }
  }

  async function sendTestNotification() : Promise<void> {
    state = { ...state, isSendingTest: true };
    dispatchState();
    try {
      const response = await fetch('/api/notifications/test', { method: 'POST' });
      if (!response.ok) {throw new Error('Failed to send test notification');}
      pushToast('success', 'Test notification sent!');
    } catch (error) {
      pushToast('error', error instanceof Error ? error.message : 'Failed to send test notification');
    } finally {
      state = { ...state, isSendingTest: false };
      dispatchState();
    }
  }

  onMount(() : () => void => {
    const stickyVisibilityHandler = (event: Event) : void => {
      if (!(event instanceof CustomEvent)) {return;}
      state = { ...state, showSticky: Boolean(event.detail) };
      dispatchState();
    };

    window.addEventListener('sticky-visibility', stickyVisibilityHandler as EventListener);

    void (async () : Promise<void> => {
      const finalizeInitialPaint = (canManageNotifications: boolean) : void => {
        state = {
          ...state,
          sessionPending: false,
          isInitialLoading: false,
          isSignedIn: Boolean(session?.user),
          canManageNotifications,
        };
        dispatchState();
      };

      const initializePushInBackground = async (canManageNotifications: boolean) : Promise<void> => {
        if (!canManageNotifications || !session?.user) {return;}
        try {
          if (!isPushSupported()) {return;}
          await registerServiceWorker();
          const [subscriptions, existing] = await Promise.all([
            fetchPushSubscriptions(),
            getExistingSubscription(),
          ]);
          state = {
            ...state,
            pushSupported: true,
            pushEnabled: !!existing && subscriptions.length > 0,
          };
          dispatchState();
        } catch (error) {
          console.error('Failed to initialize push notifications:', error);
          state = {
            ...state,
            pushSupported: false,
            pushEnabled: false,
          };
          dispatchState();
        }
      };

      try {
        session = await fetchSession();
        const canManageNotifications = NOTIFICATIONS_ALLOWED_EMAILS.includes(
          session?.user?.email ?? '',
        );
        finalizeInitialPaint(canManageNotifications);

        if (session?.user) {
          void (async () : Promise<void> => {
            try {
              profile = await fetchProfile();
              syncProfileToState();
              clearDraft();
              dispatchState();
            } catch (error) {
              console.error('Failed to load integrations profile:', error);
            }
          })();
        } else {
          window.dispatchEvent(new CustomEvent('force-sticky', { detail: true }));
          const draft = loadDraft();
          if (draft) {
            state = {
              ...state,
              fullName: draft.fullName,
              memberId: draft.memberId,
              selectedJobs: sortJobs(draft.selectedJobs),
              displayFullName: draft.fullName.trim(),
            };
            dispatchState();
          }
        }

        void initializePushInBackground(canManageNotifications);
      } catch (error) {
        console.error('Failed to initialize integrations page:', error);
        finalizeInitialPaint(false);
      }
    })();

    dispatchState();

    return () : void => {
      window.dispatchEvent(new CustomEvent('force-sticky', { detail: false }));
      window.removeEventListener('sticky-visibility', stickyVisibilityHandler as EventListener);
    };
  });
</script>

<Integrations {channel} {initialState} />
