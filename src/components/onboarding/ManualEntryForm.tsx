"use client";

import { useState } from "react";

interface ManualEntryFormProps {
  onSubmit: (memberId: string) => void;
  onCancel: () => void;
}

export function ManualEntryForm({ onSubmit, onCancel }: ManualEntryFormProps) {
  const [memberId, setMemberId] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const cleaned = memberId.trim();

    if (!cleaned) {
      setError("Please enter your member ID");
      return;
    }

    if (!/^\d+$/.test(cleaned)) {
      setError("Member ID should only contain numbers");
      return;
    }

    if (cleaned.length < 4 || cleaned.length > 10) {
      setError("Member ID should be between 4 and 10 digits");
      return;
    }

    onSubmit(cleaned.padStart(6, "0"));
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold text-zinc-100">Enter Member ID</h2>
        <p className="text-zinc-400 text-sm">
          You can find your member ID on your physical card or on your PSFC
          member services account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="memberId"
            className="block text-sm font-medium text-zinc-300 mb-2"
          >
            Member ID
          </label>
          <input
            id="memberId"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            placeholder="e.g., 123456"
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors"
          >
            Back
          </button>
          <button
            type="submit"
            className="flex-1 py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors"
          >
            Continue
          </button>
        </div>
      </form>
    </div>
  );
}
