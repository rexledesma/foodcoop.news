"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useSession } from "@/lib/auth-client";

export default function SettingsPage() {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = useSession();
  const memberProfile = useQuery(api.memberProfiles.getMemberProfile);
  const updateMemberProfile = useMutation(api.memberProfiles.updateMemberProfile);

  const [fullName, setFullName] = useState("");
  const [memberId, setMemberId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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
        text: error instanceof Error ? error.message : "Failed to save settings",
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
    </div>
  );
}
