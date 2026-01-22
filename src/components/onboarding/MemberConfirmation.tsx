"use client";

import { useState } from "react";

interface MemberConfirmationProps {
  memberId: string;
  initialName: string;
  onConfirm: (memberId: string, memberName: string) => void;
  onBack: () => void;
  isSubmitting: boolean;
}

export function MemberConfirmation({
  memberId,
  initialName,
  onConfirm,
  onBack,
  isSubmitting,
}: MemberConfirmationProps) {
  const [memberName, setMemberName] = useState(initialName);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedName = memberName.trim();
    if (!trimmedName) {
      setError("Please enter your name");
      return;
    }

    onConfirm(memberId, trimmedName);
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold text-zinc-100">Confirm Your Info</h2>
        <p className="text-zinc-400 text-sm">
          Please verify your member information before continuing.
        </p>
      </div>

      <div className="bg-zinc-800/50 rounded-xl p-6 space-y-4">
        <div className="flex justify-between items-center py-2 border-b border-zinc-700/50">
          <span className="text-zinc-400">Member ID</span>
          <span className="text-zinc-100 font-mono font-medium">{memberId}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="memberName"
            className="block text-sm font-medium text-zinc-300 mb-2"
          >
            Your Name
          </label>
          <input
            id="memberName"
            type="text"
            value={memberName}
            onChange={(e) => setMemberName(e.target.value)}
            placeholder="Enter your name"
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            disabled={isSubmitting}
          />
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          <p className="mt-2 text-xs text-zinc-500">
            This name will appear on your digital member card.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={isSubmitting}
            className="flex-1 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "Confirm"}
          </button>
        </div>
      </form>
    </div>
  );
}
