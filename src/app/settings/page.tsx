"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useSession } from "@/lib/auth-client";

const CALENDAR_PROXY_PATH = "/api/calendar";

export default function SettingsPage() {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = useSession();
  const memberProfile = useQuery(api.memberProfiles.getMemberProfile);
  const updateMemberProfile = useMutation(
    api.memberProfiles.updateMemberProfile,
  );

  const [fullName, setFullName] = useState("");
  const [memberId, setMemberId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [calendarProxyUrl, setCalendarProxyUrl] = useState("");
  const [toasts, setToasts] = useState<
    {
      id: number;
      variant: "success" | "error";
      message: string;
      visible: boolean;
    }[]
  >([]);

  // Initialize form with profile data
  useEffect(() => {
    if (memberProfile) {
      setFullName(memberProfile.memberName || "");
      setMemberId(memberProfile.memberId || "");
    }
  }, [memberProfile]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!sessionPending && !session?.user) {
      router.push("/login");
    }
  }, [session, sessionPending, router]);

  useEffect(() => {
    setCalendarProxyUrl(`${window.location.origin}${CALENDAR_PROXY_PATH}`);
  }, []);

  const calendarDisplayUrl = calendarProxyUrl || CALENDAR_PROXY_PATH;
  const googleCalendarUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(
    calendarDisplayUrl,
  )}`;

  const enqueueToast = (variant: "success" | "error", message: string) => {
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

  const handleCopyCalendarUrl = async () => {
    try {
      await navigator.clipboard.writeText(calendarDisplayUrl);
      enqueueToast("success", "Copied calendar URL to clipboard.");
    } catch (error) {
      enqueueToast(
        "error",
        "Clipboard copy failed. Copy manually from the modal.",
      );
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);

    try {
      await updateMemberProfile({
        memberName: fullName.trim(),
        memberId: memberId.trim(),
      });
      setSaveMessage({ type: "success", text: "Settings saved" });
    } catch (error) {
      setSaveMessage({
        type: "error",
        text:
          error instanceof Error ? error.message : "Failed to save settings",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (sessionPending || memberProfile === undefined) {
    return (
      <div className="px-4 py-6 max-w-2xl mx-auto">
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
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
        Settings
      </h1>

      <form onSubmit={handleSave} className="space-y-6">
        <div>
          <label
            htmlFor="fullName"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
          >
            Full Name
          </label>
          <input
            type="text"
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400"
            placeholder="Enter your full name"
          />
        </div>

        <div>
          <label
            htmlFor="memberId"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
          >
            Member ID
          </label>
          <input
            type="text"
            id="memberId"
            inputMode="numeric"
            pattern="[0-9]*"
            value={memberId}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, "");
              setMemberId(value);
            }}
            className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 font-mono"
            placeholder="Enter your member ID"
          />
        </div>

        {saveMessage && (
          <div
            className={`p-4 rounded-xl ${
              saveMessage.type === "success"
                ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
            }`}
          >
            {saveMessage.text}
          </div>
        )}

        <button
          type="submit"
          disabled={isSaving}
          className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-xl transition-colors"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </form>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Third Party Accounts
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Connect services like Google Calendar to keep your shifts in sync.
        </p>

        <div className="mt-6 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Shift Calendar Syncing
              </h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Sync the Shift Calendar with your Google, Outlook, or Apple
                calendar.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCalendarModalOpen(true)}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors"
            >
              Add iCal subscription
            </button>
          </div>
        </div>
      </section>

      {isCalendarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Add iCal subscription
                </h3>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  Add the shift calendar to your calendar app to keep up with
                  new shifts and updates.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCalendarModalOpen(false)}
                className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Close
              </button>
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
                className="w-full px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-medium hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
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
