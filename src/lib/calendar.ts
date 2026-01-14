import type { Shift } from "./types";

const MONTHS: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

export interface CalendarEvent {
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  location: string;
}

/**
 * Parses a shift datetime string like "February 9, 8:00am" into a Date object.
 * Infers the year: uses current year, or next year if the date has passed.
 */
export function parseShiftDateTime(dateTimeString: string): Date {
  const regex = /^(\w+)\s+(\d+),\s*(\d+):(\d+)(am|pm)$/i;
  const match = dateTimeString.match(regex);

  if (!match) {
    throw new Error(`Invalid date format: ${dateTimeString}`);
  }

  const [, monthStr, dayStr, hourStr, minuteStr, ampm] = match;
  const month = MONTHS[monthStr.toLowerCase()];
  const day = parseInt(dayStr, 10);
  let hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);

  // Convert to 24-hour format
  if (ampm.toLowerCase() === "pm" && hour !== 12) {
    hour += 12;
  } else if (ampm.toLowerCase() === "am" && hour === 12) {
    hour = 0;
  }

  // Determine year - assume current year, but if date is in past, use next year
  const now = new Date();
  let year = now.getFullYear();
  const candidateDate = new Date(year, month, day, hour, minute);

  if (candidateDate < now) {
    year += 1;
  }

  return new Date(year, month, day, hour, minute);
}

/**
 * Converts a Shift to a CalendarEvent.
 */
export function shiftToCalendarEvent(shift: Shift): CalendarEvent {
  return {
    title: `PSFC: ${shift.shiftName}`,
    description: `Park Slope Food Coop work shift: ${shift.shiftName}`,
    startDate: parseShiftDateTime(shift.startTime),
    endDate: parseShiftDateTime(shift.endTime),
    location: "Park Slope Food Coop, 782 Union St, Brooklyn, NY 11215",
  };
}

/**
 * Formats a Date to Google Calendar's required format: YYYYMMDDTHHmmssZ
 */
function formatDateForGoogle(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Generates a Google Calendar URL for the given event.
 */
export function generateGoogleCalendarUrl(event: CalendarEvent): string {
  const baseUrl = "https://calendar.google.com/calendar/render";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${formatDateForGoogle(event.startDate)}/${formatDateForGoogle(event.endDate)}`,
    details: event.description,
    location: event.location,
  });

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Formats a Date to ICS format: YYYYMMDDTHHmmss
 */
function formatDateForICS(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}T${hours}${minutes}${seconds}`;
}

/**
 * Escapes special characters for ICS format.
 */
function escapeICS(text: string): string {
  return text.replace(/[\\;,]/g, (match) => `\\${match}`).replace(/\n/g, "\\n");
}

/**
 * Generates ICS file content for the given event.
 */
export function generateICSContent(event: CalendarEvent): string {
  const uid = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}@foodcoop.tech`;
  const dtstamp = formatDateForICS(new Date());
  const dtstart = formatDateForICS(event.startDate);
  const dtend = formatDateForICS(event.endDate);

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Food Coop Tech//Shift Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${escapeICS(event.title)}`,
    `DESCRIPTION:${escapeICS(event.description)}`,
    `LOCATION:${escapeICS(event.location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/**
 * Triggers download of an ICS file.
 */
export function downloadICSFile(event: CalendarEvent, filename: string): void {
  const content = generateICSContent(event);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
