"use client";

import { useState, useRef, useEffect } from "react";
import type { Shift } from "@/lib/types";
import {
  shiftToCalendarEvent,
  generateGoogleCalendarUrl,
  downloadICSFile,
} from "@/lib/calendar";

interface AddToCalendarButtonProps {
  shift: Shift;
}

export function AddToCalendarButton({ shift }: AddToCalendarButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleGoogleCalendar = () => {
    const event = shiftToCalendarEvent(shift);
    const url = generateGoogleCalendarUrl(event);
    window.open(url, "_blank");
    setIsOpen(false);
  };

  const handleDownloadICS = () => {
    const event = shiftToCalendarEvent(shift);
    const filename = `${shift.shiftName.replace(/\s+/g, "-").toLowerCase()}.ics`;
    downloadICSFile(event, filename);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-600 hover:text-white dark:hover:bg-zinc-500 rounded-lg transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        Add to calendar
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 z-10 overflow-hidden">
          <button
            onClick={handleGoogleCalendar}
            className="w-full px-4 py-2 text-left text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
          >
            Google Calendar
          </button>
          <button
            onClick={handleDownloadICS}
            className="w-full px-4 py-2 text-left text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
          >
            Download .ics
          </button>
        </div>
      )}
    </div>
  );
}
