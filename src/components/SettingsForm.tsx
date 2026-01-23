"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useSession } from "@/lib/auth-client";
import { AppleWalletCard } from "./AppleWalletCard";

const CALENDAR_PROXY_PATH = "/api/calendar";

const SHIFT_JOB_OPTIONS = [
  "🚽 Bathroom",
  "🍺 Beer",
  "🧼 Bins",
  "🍞 Bread Stocking",
  "🫘 Bulk Lifting",
  "🛒 Cart Return",
  "🧽 Case Maintenance",
  "💵 Cashier",
  "💳 Checkout",
  "🍛 CHIPS Food Drive",
  "CHiPS Gala",
  "🏝 Cleaning",
  "🥛 Dairy Lifting",
  "🚛 Delivery Support",
  "💰 Drawer",
  "⌨️ Enrollment Data Entry",
  "📃 Enrollment",
  "🎟 Entrance/Greeter",
  "🥫 Flex",
  "🍿 Food Processing TL ",
  "🍿 Food Processing ",
  "👀 Front End Support",
  "🗳️ General Meeting",
  "🧴 Health & Beauty",
  "🖥 Inventory Data",
  "📋 Inventory",
  "🍀 Inventory: Produce",
  "🚚 Lifting",
  "🍖 Meat Processing & Lifting",
  "📗 Office",
  "🥬 Produce Processing",
  "🥦 Producer",
  "📦 Receiving: Team Leader",
  "🛠 Repairs",
  "🖨 Scan Invoices",
  "🧺 Set-up & Equipment Cleaning",
  "🗂 Sort & Collate",
  "Soup Cleaning",
  "🍲 Soup: Food Services",
  "✍️ Soup: Guest Services- Outdoor",
  "🙂 Soup: Reception",
  "Special Project: Data Entry",
  "📦 Stocking",
  "🦃 Turkey",
  "🍬 Vitamins",
  "🧾 Vouchers",
];

type ToastVariant = "success" | "error" | "warning";

export function SettingsForm() {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = useSession();
  const memberProfile = useQuery(api.memberProfiles.getMemberProfile);
  const updateMemberProfile = useMutation(
    api.memberProfiles.updateMemberProfile,
  );

  const [fullName, setFullName] = useState("");
  const [memberId, setMemberId] = useState("");
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [calendarId, setCalendarId] = useState("");
  const [calendarOrigin, setCalendarOrigin] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [jobSearch, setJobSearch] = useState("");
  const [isJobDropdownOpen, setIsJobDropdownOpen] = useState(false);
  const [highlightedJobIndex, setHighlightedJobIndex] = useState(0);
  const jobOptionRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [toasts, setToasts] = useState<
    {
      id: number;
      variant: "success" | "error" | "warning";
      message: string;
      visible: boolean;
    }[]
  >([]);

  const normalizeJobSortKey = (job: string) =>
    job
      .replace(/^\p{Extended_Pictographic}+\s*/gu, "")
      .toLowerCase()
      .trim();

  // Initialize form with profile data
  useEffect(() => {
    const sortJobs = (jobs: string[]) =>
      [...jobs].sort((a, b) =>
        normalizeJobSortKey(a).localeCompare(normalizeJobSortKey(b)),
      );

    if (memberProfile) {
      setFullName(memberProfile.memberName || "");
      setMemberId(memberProfile.memberId || "");
      setSelectedJobs(sortJobs(memberProfile.jobFilters || []));
      setCalendarId(memberProfile.calendarId || "");
    }
  }, [memberProfile]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!sessionPending && !session?.user) {
      router.push("/login");
    }
  }, [session, sessionPending, router]);

  useEffect(() => {
    setCalendarOrigin(window.location.origin);
  }, []);

  const calendarPath = `${CALENDAR_PROXY_PATH}/${calendarId}`;
  const calendarDisplayUrl = calendarOrigin
    ? `${calendarOrigin}${calendarPath}`
    : calendarPath;
  const googleCalendarUrl = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(
    calendarDisplayUrl.replace(/^https:\/\//, "http://"),
  )}`;

  const normalizedSearch = jobSearch.trim().toLowerCase();
  const filteredJobOptions = normalizedSearch
    ? SHIFT_JOB_OPTIONS.filter((job) =>
        job.toLowerCase().includes(normalizedSearch),
      )
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

  useEffect(() => {
    if (!isJobDropdownOpen || highlightedJobIndex < 0) {
      return;
    }

    const job = filteredJobOptions[highlightedJobIndex];
    const element = job ? jobOptionRefs.current[job] : null;
    element?.scrollIntoView({ block: "nearest" });
  }, [filteredJobOptions, highlightedJobIndex, isJobDropdownOpen]);

  const showToast = (variant: ToastVariant, message: string) => {
    const id = Date.now();
    setToasts((previous) => [
      ...previous,
      { id, variant, message, visible: false },
    ]);

    window.setTimeout(() => {
      setToasts((previous) =>
        previous.map((toast) =>
          toast.id === id ? { ...toast, visible: true } : toast,
        ),
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
      previous.map((toast) =>
        toast.id === id ? { ...toast, ...updates } : toast,
      ),
    );
  };

  const dismissToast = (id: number) => {
    window.setTimeout(() => {
      setToasts((previous) =>
        previous.map((toast) =>
          toast.id === id ? { ...toast, visible: false } : toast,
        ),
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
    try {
      await updateMemberProfile({ jobFilters: nextJobs });
    } catch (error) {
      enqueueToast(
        "error",
        error instanceof Error
          ? error.message
          : "Failed to update shift filters",
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
    setIsCalendarModalOpen(true);
  };

  const handleCopyCalendarUrl = async () => {
    if (!calendarId) {
      enqueueToast("error", "Create a calendar subscription first.");
      return;
    }

    try {
      await navigator.clipboard.writeText(calendarDisplayUrl);
      enqueueToast("success", "Copied calendar URL to clipboard.");
    } catch {
      enqueueToast(
        "error",
        "Clipboard copy failed. Copy manually from the modal.",
      );
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const toastId = showToast("warning", "Saving profile...");

    try {
      await updateMemberProfile({
        memberName: fullName.trim(),
        memberId: memberId.trim(),
        jobFilters: selectedJobs,
      });
      updateToast(toastId, {
        variant: "success",
        message: "Profile successfully updated.",
      });
      dismissToast(toastId);
    } catch (error) {
      updateToast(toastId, {
        variant: "error",
        message:
          error instanceof Error ? error.message : "Failed to save settings",
      });
      dismissToast(toastId);
    } finally {
      setIsSaving(false);
    }
  };

  if (sessionPending || memberProfile === undefined) {
    return (
      <div className="px-4 py-6 max-w-3xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-zinc-200 dark:bg-zinc-700 rounded w-32 mb-6" />
          <div className="space-y-4">
            <div className="h-10 bg-zinc-200 dark:bg-zinc-700 rounded" />
            <div className="h-10 bg-zinc-200 dark:bg-zinc-700 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
        Settings
      </h1>

      <form onSubmit={handleSave} className="space-y-6">
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Profile
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Edit your unofficial member card.
          </p>
          <AppleWalletCard
            memberName={fullName}
            memberId={memberId}
            onMemberNameChange={setFullName}
            onMemberIdChange={(value) => setMemberId(value.replace(/\D/g, ""))}
          />
        </section>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-1.5 text-sm bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:opacity-60 text-white font-medium rounded-lg transition-colors"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
          <button
            type="button"
            disabled
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500 font-medium rounded-lg cursor-not-allowed"
          >
            Add to Apple Wallet
            <span className="text-xs bg-zinc-300 dark:bg-zinc-600 px-1.5 py-0.5 rounded-full">
              Soon
            </span>
          </button>
        </div>
      </form>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Third Party Accounts
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Link your account to your calendar to view your prospective shifts.
        </p>

        <div className="mt-6 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Shift Calendar Syncing
              </h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Sync the shift calendar with your Google, Outlook, or Apple
                calendar.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenCalendarModal}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors"
            >
              Add iCal subscription
            </button>
          </div>

          <div className="mt-6 space-y-3">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Selected Shifts
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Filter the shift calendar for your preferred shifts.
              </p>
            </div>
            <div className="relative">
              <input
                type="text"
                value={jobSearch}
                onChange={(event) => {
                  setJobSearch(event.target.value);
                  setIsJobDropdownOpen(true);
                }}
                onFocus={() => setIsJobDropdownOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setIsJobDropdownOpen(false), 150);
                }}
                onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setIsJobDropdownOpen(true);
                    if (filteredJobOptions.length === 0) {
                      return;
                    }
                    setHighlightedJobIndex((previous) =>
                      previous < filteredJobOptions.length - 1
                        ? previous + 1
                        : 0,
                    );
                    return;
                  }

                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setIsJobDropdownOpen(true);
                    if (filteredJobOptions.length === 0) {
                      return;
                    }
                    setHighlightedJobIndex((previous) =>
                      previous > 0
                        ? previous - 1
                        : filteredJobOptions.length - 1,
                    );
                    return;
                  }

                  if (event.key === "Enter") {
                    if (!isJobDropdownOpen) {
                      setIsJobDropdownOpen(true);
                      return;
                    }
                    if (filteredJobOptions.length === 0) {
                      return;
                    }
                    event.preventDefault();
                    const job =
                      filteredJobOptions[Math.max(highlightedJobIndex, 0)];
                    if (job) {
                      toggleJob(job);
                    }
                    return;
                  }

                  if (event.key === "Escape") {
                    setIsJobDropdownOpen(false);
                  }
                }}
                placeholder="Search jobs"
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-green-400"
              />
              {isJobDropdownOpen && (
                <div className="absolute z-10 mt-2 w-full rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                  <div className="max-h-48 overflow-y-auto">
                    {filteredJobOptions.length > 0 ? (
                      filteredJobOptions.map((job, index) => {
                        const isSelected = selectedJobs.includes(job);
                        const isHighlighted = index === highlightedJobIndex;
                        return (
                          <button
                            key={job}
                            ref={(element) => {
                              jobOptionRefs.current[job] = element;
                            }}
                            type="button"
                            onClick={() => toggleJob(job)}
                            onMouseEnter={() => setHighlightedJobIndex(index)}
                            className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                              isSelected
                                ? "bg-green-50 text-green-700 dark:bg-green-500/20 dark:text-green-200"
                                : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                            } ${
                              isHighlighted && !isSelected
                                ? "bg-zinc-100 dark:bg-zinc-800"
                                : ""
                            }`}
                          >
                            <span>{job}</span>
                            {isSelected && (
                              <span className="text-xs">Selected</span>
                            )}
                          </button>
                        );
                      })
                    ) : (
                      <div className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                        No matching jobs.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {selectedJobs.length > 0 ? (
                selectedJobs.map((job) => (
                  <span
                    key={job}
                    className="group inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-red-50 hover:text-red-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-red-500/20 dark:hover:text-red-200"
                  >
                    {job}
                    <button
                      type="button"
                      onClick={() => removeJob(job)}
                      className="text-xs font-semibold text-zinc-400 transition-colors group-hover:text-red-600 dark:text-zinc-400 dark:group-hover:text-red-200"
                      aria-label={`Remove ${job}`}
                    >
                      ×
                    </button>
                  </span>
                ))
              ) : (
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  All shifts included.
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {isCalendarModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setIsCalendarModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Add iCal subscription
              </h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Add the shift calendar to your calendar app to keep up with new
                shifts and updates.
              </p>
            </div>

            <div className="mt-6 space-y-3">
              <a
                href={googleCalendarUrl}
                target="_blank"
                rel="noreferrer"
                className="block w-full text-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors"
              >
                Add to Google Calendar
              </a>
              <button
                type="button"
                onClick={handleCopyCalendarUrl}
                disabled={!calendarId}
                className="w-full px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-medium hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-60 disabled:hover:text-zinc-500 dark:disabled:hover:text-zinc-400 transition-colors"
              >
                Add URL to clipboard
              </button>
            </div>
          </div>
        </div>
      )}

      {toasts.length > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 space-y-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`rounded-xl px-4 py-3 text-sm font-medium shadow-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 transition-all duration-300 ease-out ${
                toast.visible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-2"
              }`}
            >
              <span
                className={
                  toast.variant === "success"
                    ? "text-green-600 dark:text-green-400"
                    : toast.variant === "warning"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-red-600 dark:text-red-400"
                }
              >
                {toast.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
