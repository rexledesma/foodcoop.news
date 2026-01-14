"use client";

import { useState, useEffect } from "react";
import type { Shift } from "@/lib/types";
import { AddToCalendarButton } from "./AddToCalendarButton";

interface ShiftListProps {
  isAuthenticated: boolean;
}

export function ShiftList({ isAuthenticated }: ShiftListProps) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      fetchShifts();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const fetchShifts = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/shifts");
      const data = await response.json();

      if (response.ok) {
        setShifts(data.shifts);
      } else {
        setError(data.error || "Failed to load shifts");
      }
    } catch {
      setError("Failed to load shift data");
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="text-center py-12">
        <svg
          className="w-16 h-16 mx-auto text-zinc-300 dark:text-zinc-700"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="2" />
          <line x1="16" y1="2" x2="16" y2="6" strokeWidth="2" />
          <line x1="8" y1="2" x2="8" y2="6" strokeWidth="2" />
          <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2" />
        </svg>
        <h3 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Sign in to view shifts
        </h3>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">
          Your upcoming work shifts will appear here
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm">
        {error}
        <button
          onClick={fetchShifts}
          className="ml-2 underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (shifts.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="w-16 h-16 mx-auto text-zinc-300 dark:text-zinc-700"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="2" />
          <line x1="16" y1="2" x2="16" y2="6" strokeWidth="2" />
          <line x1="8" y1="2" x2="8" y2="6" strokeWidth="2" />
          <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2" />
          <path strokeLinecap="round" strokeWidth="2" d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
        </svg>
        <h3 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          No upcoming shifts
        </h3>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">
          Schedule your next shift in Member Services
        </p>
        <a
          href="https://members.foodcoop.com/services/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-4 text-green-600 dark:text-green-400 hover:underline"
        >
          Open Member Services
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Upcoming Shifts
      </h2>

      <div className="space-y-3">
        {shifts.map((shift) => (
          <div
            key={shift.id}
            className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {shift.shiftName}
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {shift.startTime} - {shift.endTime.split(", ")[1]}
                </p>
              </div>
              <AddToCalendarButton shift={shift} />
            </div>
          </div>
        ))}
      </div>

      <div className="pt-4 text-center">
        <a
          href="https://members.foodcoop.com/services/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-green-600 dark:text-green-400 hover:underline"
        >
          Manage shifts in Member Services
        </a>
      </div>
    </div>
  );
}
