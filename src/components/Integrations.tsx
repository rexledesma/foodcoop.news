'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useSession } from '@/lib/auth-client';
import SvelteMount from '@/components/SvelteMount';
import IntegrationsView from '@/components/integrations/Integrations.svelte';
import { useScrollVisibility } from '@/components/ScrollVisibilityProvider';
import {
  extractSubscriptionKeys,
  getExistingSubscription,
  isPushSupported,
  registerServiceWorker,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/push-notifications';
import { withNextParam } from '@/lib/auth-redirect';

const CALENDAR_PROXY_PATH = '/api/calendar';
const DRAFT_STORAGE_KEY = 'integrations:draft';

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

type ToastVariant = 'success' | 'error' | 'warning';

type IntegrationDraft = {
  fullName: string;
  memberId: string;
  selectedJobs: string[];
};

type IntegrationToast = {
  id: number;
  variant: ToastVariant;
  message: string;
  visible: boolean;
};

type IntegrationsClientState = {
  isInitialLoading: boolean;
  showSticky: boolean;
  sessionPending: boolean;
  isSignedIn: boolean;
  signupHref: string;
  fullName: string;
  memberId: string;
  displayFullName: string;
  isSaving: boolean;
  isGeneratingPass: boolean;
  isGeneratingGooglePass: boolean;
  calendarId: string;
  isCalendarModalOpen: boolean;
  calendarDisplayUrl: string;
  googleCalendarUrl: string;
  outlookCalendarUrl: string;
  selectedJobs: string[];
  jobSearch: string;
  isJobDropdownOpen: boolean;
  highlightedJobIndex: number;
  filteredJobOptions: string[];
  pushSupported: boolean;
  canManageNotifications: boolean;
  pushEnabled: boolean;
  pushLoading: boolean;
  isSendingTest: boolean;
  toasts: IntegrationToast[];
  onMemberNameChange: (value: string) => void;
  onMemberIdChange: (value: string) => void;
  onSave: () => Promise<void>;
  onAddToWallet: () => Promise<void>;
  onAddToGoogleWallet: () => Promise<void>;
  onOpenCalendarModal: () => void;
  onCloseCalendarModal: () => void;
  onCopyCalendarUrl: () => Promise<void>;
  onJobSearchChange: (value: string) => void;
  onJobSearchFocus: () => void;
  onJobSearchBlur: () => void;
  onJobSearchKeyDown: (event: KeyboardEvent) => void;
  onToggleJob: (job: string) => void;
  onRemoveJob: (job: string) => void;
  onHighlightJobIndex: (index: number) => void;
  onTogglePush: () => Promise<void>;
  onSendTestNotification: () => Promise<void>;
};

const loadDraft = (): IntegrationDraft | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<IntegrationDraft>;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const fullName = typeof parsed.fullName === 'string' ? parsed.fullName : '';
    const memberId = typeof parsed.memberId === 'string' ? parsed.memberId : '';
    const selectedJobs = Array.isArray(parsed.selectedJobs)
      ? parsed.selectedJobs.filter((job): job is string => typeof job === 'string')
      : [];

    return { fullName, memberId, selectedJobs };
  } catch {
    return null;
  }
};

const saveDraft = (draft: IntegrationDraft) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Ignore localStorage write errors
  }
};

const clearDraft = () => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Ignore localStorage errors
  }
};

const normalizeJobSortKey = (job: string) =>
  job
    .replace(/^\p{Extended_Pictographic}+\s*/gu, '')
    .toLowerCase()
    .trim();

export function Integrations() {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = useSession();
  const memberProfile = useQuery(api.memberProfiles.getMemberProfile);
  const updateMemberProfile = useMutation(api.memberProfiles.updateMemberProfile);
  const { showSticky } = useScrollVisibility();

  const [fullName, setFullName] = useState('');
  const [memberId, setMemberId] = useState('');
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [calendarId, setCalendarId] = useState('');
  const [calendarOrigin, setCalendarOrigin] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [jobSearch, setJobSearch] = useState('');
  const [isJobDropdownOpen, setIsJobDropdownOpen] = useState(false);
  const [highlightedJobIndex, setHighlightedJobIndex] = useState(0);
  const isDraftReadyRef = useRef(false);
  const [toasts, setToasts] = useState<IntegrationToast[]>([]);
  const [isGeneratingPass, setIsGeneratingPass] = useState(false);
  const [isGeneratingGooglePass, setIsGeneratingGooglePass] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const savePushSubscription = useMutation(api.pushSubscriptions.savePushSubscription);
  const deletePushSubscription = useMutation(api.pushSubscriptions.deletePushSubscription);
  const pushSubscriptions = useQuery(api.pushSubscriptions.getUserPushSubscriptions);
  const channelRef = useRef<string>(`integrations-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    const sortJobs = (jobs: string[]) =>
      [...jobs].sort((a, b) => normalizeJobSortKey(a).localeCompare(normalizeJobSortKey(b)));

    if (memberProfile) {
      setFullName(memberProfile.memberName || '');
      setMemberId(memberProfile.memberId || '');
      setSelectedJobs(sortJobs(memberProfile.jobFilters || []));
      setCalendarId(memberProfile.calendarId || '');
    }
  }, [memberProfile]);

  useEffect(() => {
    if (session?.user) {
      return;
    }
    const draft = loadDraft();
    if (draft) {
      setFullName(draft.fullName);
      setMemberId(draft.memberId);
      setSelectedJobs(draft.selectedJobs);
    }
    isDraftReadyRef.current = true;
  }, [session?.user]);

  useEffect(() => {
    if (session?.user && memberProfile) {
      clearDraft();
    }
  }, [session?.user, memberProfile]);

  useEffect(() => {
    if (session?.user || !isDraftReadyRef.current) {
      return;
    }
    saveDraft({ fullName, memberId, selectedJobs });
  }, [fullName, memberId, selectedJobs, session?.user]);

  useEffect(() => {
    setCalendarOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!isPushSupported()) {
      return;
    }
    setPushSupported(true);

    void (async () => {
      await registerServiceWorker();
      const existing = await getExistingSubscription();
      if (existing && pushSubscriptions && pushSubscriptions.length > 0) {
        setPushEnabled(true);
      }
    })();
  }, [pushSubscriptions]);

  useEffect(() => {
    if (!isCalendarModalOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsCalendarModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCalendarModalOpen]);

  const requireAuth = () => {
    if (session?.user) {
      return true;
    }
    router.push(withNextParam('/signup', '/integrations'));
    return false;
  };

  const calendarPath = `${CALENDAR_PROXY_PATH}/${calendarId}`;
  const calendarDisplayUrl = calendarOrigin ? `${calendarOrigin}${calendarPath}` : calendarPath;
  const displayFullName = fullName.trim();
  const googleCalendarUrl = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(
    calendarDisplayUrl.replace(/^https:\/\//, 'http://'),
  )}`;
  const outlookCalendarUrl = `https://outlook.live.com/calendar/0/addcalendar?url=${encodeURIComponent(
    calendarDisplayUrl.replace(/^https:\/\//, 'webcal://'),
  )}`;

  const normalizedSearch = jobSearch.trim().toLowerCase();
  const filteredJobOptions = normalizedSearch
    ? SHIFT_JOB_OPTIONS.filter((job) => job.toLowerCase().includes(normalizedSearch))
    : SHIFT_JOB_OPTIONS;

  useEffect(() => {
    if (!isJobDropdownOpen) {
      return;
    }

    if (filteredJobOptions.length === 0) {
      setHighlightedJobIndex(-1);
    } else {
      setHighlightedJobIndex(0);
    }
  }, [filteredJobOptions.length, isJobDropdownOpen]);

  const showToast = (variant: ToastVariant, message: string) => {
    const id = Date.now();
    setToasts((previous) => [...previous, { id, variant, message, visible: false }]);

    window.setTimeout(() => {
      setToasts((previous) =>
        previous.map((toast) => (toast.id === id ? { ...toast, visible: true } : toast)),
      );
    }, 10);

    return id;
  };

  const updateToast = (
    id: number,
    updates: Partial<{
      variant: ToastVariant;
      message: string;
      visible: boolean;
    }>,
  ) => {
    setToasts((previous) =>
      previous.map((toast) => (toast.id === id ? { ...toast, ...updates } : toast)),
    );
  };

  const dismissToast = (id: number) => {
    window.setTimeout(() => {
      setToasts((previous) =>
        previous.map((toast) => (toast.id === id ? { ...toast, visible: false } : toast)),
      );
    }, 2500);

    window.setTimeout(() => {
      setToasts((previous) => previous.filter((toast) => toast.id !== id));
    }, 3000);
  };

  const enqueueToast = (variant: ToastVariant, message: string) => {
    const id = showToast(variant, message);
    dismissToast(id);
  };

  const saveJobFilters = async (nextJobs: string[]) => {
    if (!session?.user) {
      return;
    }
    try {
      await updateMemberProfile({ jobFilters: nextJobs });
    } catch (error) {
      enqueueToast(
        'error',
        error instanceof Error ? error.message : 'Failed to update shift filters',
      );
    }
  };

  const toggleJob = (job: string) => {
    setSelectedJobs((previous) => {
      const nextJobs = previous.includes(job)
        ? previous.filter((item) => item !== job)
        : [...previous, job];
      void saveJobFilters(nextJobs);
      return nextJobs;
    });
  };

  const removeJob = (job: string) => {
    setSelectedJobs((previous) => {
      const nextJobs = previous.filter((item) => item !== job);
      void saveJobFilters(nextJobs);
      return nextJobs;
    });
  };

  const handleOpenCalendarModal = () => {
    if (!requireAuth()) {
      return;
    }
    setIsCalendarModalOpen(true);
  };

  const handleCopyCalendarUrl = async () => {
    if (!requireAuth()) {
      return;
    }
    if (!calendarId) {
      enqueueToast('error', 'Create a calendar subscription first.');
      return;
    }

    try {
      await navigator.clipboard.writeText(calendarDisplayUrl);
      enqueueToast('success', 'Copied calendar URL to clipboard.');
    } catch {
      enqueueToast('error', 'Clipboard copy failed. Copy manually from the modal.');
    }
  };

  const handleTogglePush = async () => {
    if (!requireAuth()) {
      return;
    }
    setPushLoading(true);
    try {
      if (pushEnabled) {
        const existing = await getExistingSubscription();
        if (existing) {
          await deletePushSubscription({ endpoint: existing.endpoint });
        }
        await unsubscribeFromPush();
        setPushEnabled(false);
        enqueueToast('success', 'Notifications disabled.');
      } else {
        const subscription = await subscribeToPush();
        const keys = extractSubscriptionKeys(subscription);
        await savePushSubscription(keys);
        setPushEnabled(true);
        enqueueToast('success', 'Notifications enabled.');
      }
    } catch (error) {
      enqueueToast(
        'error',
        error instanceof Error ? error.message : 'Failed to update notification settings',
      );
    } finally {
      setPushLoading(false);
    }
  };

  const handleSendTestNotification = async () => {
    setIsSendingTest(true);
    try {
      const response = await fetch('/api/notifications/test', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Failed to send test notification');
      }
      enqueueToast('success', 'Test notification sent!');
    } catch (error) {
      enqueueToast(
        'error',
        error instanceof Error ? error.message : 'Failed to send test notification',
      );
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleSave = async () => {
    if (!requireAuth()) {
      return;
    }
    setIsSaving(true);

    const toastId = showToast('warning', 'Saving profile...');

    try {
      await updateMemberProfile({
        memberName: fullName.trim(),
        memberId: memberId.trim(),
        jobFilters: selectedJobs,
      });
      updateToast(toastId, {
        variant: 'success',
        message: 'Profile successfully updated.',
      });
      dismissToast(toastId);
    } catch (error) {
      updateToast(toastId, {
        variant: 'error',
        message: error instanceof Error ? error.message : 'Failed to save settings',
      });
      dismissToast(toastId);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddToWallet = async () => {
    if (!requireAuth()) {
      return;
    }
    setIsGeneratingPass(true);
    const toastId = showToast('warning', 'Saving card details...');
    try {
      await updateMemberProfile({
        memberName: fullName.trim(),
        memberId: memberId.trim(),
      });
      updateToast(toastId, {
        variant: 'success',
        message: 'Card details saved. Generating pass...',
      });

      const response = await fetch('/api/wallet/pass');
      if (!response.ok) {
        throw new Error('Failed to generate pass');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'psfc-member-card.pkpass';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      updateToast(toastId, {
        variant: 'success',
        message: 'Pass downloaded successfully.',
      });
      dismissToast(toastId);
    } catch (error) {
      updateToast(toastId, {
        variant: 'error',
        message: error instanceof Error ? error.message : 'Failed to generate pass',
      });
      dismissToast(toastId);
    } finally {
      setIsGeneratingPass(false);
    }
  };

  const handleAddToGoogleWallet = async () => {
    if (!requireAuth()) {
      return;
    }
    setIsGeneratingGooglePass(true);
    const toastId = showToast('warning', 'Saving card details...');
    try {
      await updateMemberProfile({
        memberName: fullName.trim(),
        memberId: memberId.trim(),
      });
      updateToast(toastId, {
        variant: 'success',
        message: 'Card details saved. Generating pass...',
      });

      const response = await fetch('/api/wallet/google');
      if (!response.ok) {
        throw new Error('Failed to generate pass');
      }
      const { url } = await response.json();
      window.open(url, '_blank');
      updateToast(toastId, {
        variant: 'success',
        message: 'Opening Google Wallet...',
      });
      dismissToast(toastId);
    } catch (error) {
      updateToast(toastId, {
        variant: 'error',
        message: error instanceof Error ? error.message : 'Failed to generate pass',
      });
      dismissToast(toastId);
    } finally {
      setIsGeneratingGooglePass(false);
    }
  };

  const handleJobSearchKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsJobDropdownOpen(true);
      if (filteredJobOptions.length === 0) {
        return;
      }
      setHighlightedJobIndex((previous) =>
        previous < filteredJobOptions.length - 1 ? previous + 1 : 0,
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setIsJobDropdownOpen(true);
      if (filteredJobOptions.length === 0) {
        return;
      }
      setHighlightedJobIndex((previous) =>
        previous > 0 ? previous - 1 : filteredJobOptions.length - 1,
      );
      return;
    }

    if (event.key === 'Enter') {
      if (!isJobDropdownOpen) {
        setIsJobDropdownOpen(true);
        return;
      }
      if (filteredJobOptions.length === 0) {
        return;
      }
      event.preventDefault();
      const job = filteredJobOptions[Math.max(highlightedJobIndex, 0)];
      if (job) {
        toggleJob(job);
      }
      return;
    }

    if (event.key === 'Escape') {
      setIsJobDropdownOpen(false);
    }
  };

  const isInitialLoading = sessionPending || memberProfile === undefined;
  const signupHref = withNextParam('/signup', '/integrations');
  const canManageNotifications = (process.env.NEXT_PUBLIC_NOTIFICATIONS_ALLOWED_EMAILS ?? '')
    .split(',')
    .includes(session?.user?.email ?? '');

  const state: IntegrationsClientState = {
    isInitialLoading,
    showSticky,
    sessionPending,
    isSignedIn: Boolean(session?.user),
    signupHref,
    fullName,
    memberId,
    displayFullName,
    isSaving,
    isGeneratingPass,
    isGeneratingGooglePass,
    calendarId,
    isCalendarModalOpen,
    calendarDisplayUrl,
    googleCalendarUrl,
    outlookCalendarUrl,
    selectedJobs,
    jobSearch,
    isJobDropdownOpen,
    highlightedJobIndex,
    filteredJobOptions,
    pushSupported,
    canManageNotifications,
    pushEnabled,
    pushLoading,
    isSendingTest,
    toasts,
    onMemberNameChange: setFullName,
    onMemberIdChange: (value: string) => setMemberId(value.replace(/\D/g, '')),
    onSave: handleSave,
    onAddToWallet: handleAddToWallet,
    onAddToGoogleWallet: handleAddToGoogleWallet,
    onOpenCalendarModal: handleOpenCalendarModal,
    onCloseCalendarModal: () => setIsCalendarModalOpen(false),
    onCopyCalendarUrl: handleCopyCalendarUrl,
    onJobSearchChange: (value: string) => {
      setJobSearch(value);
      setIsJobDropdownOpen(true);
    },
    onJobSearchFocus: () => setIsJobDropdownOpen(true),
    onJobSearchBlur: () => {
      window.setTimeout(() => setIsJobDropdownOpen(false), 150);
    },
    onJobSearchKeyDown: handleJobSearchKeyDown,
    onToggleJob: toggleJob,
    onRemoveJob: removeJob,
    onHighlightJobIndex: setHighlightedJobIndex,
    onTogglePush: handleTogglePush,
    onSendTestNotification: handleSendTestNotification,
  };

  const initialStateRef = useRef(state);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(`integrations-state:update:${channelRef.current}`, {
        detail: state,
      }),
    );
  });

  const props = useMemo(
    () => ({
      channel: channelRef.current,
      initialState: initialStateRef.current,
    }),
    [],
  );

  return <SvelteMount component={IntegrationsView} props={props} />;
}
