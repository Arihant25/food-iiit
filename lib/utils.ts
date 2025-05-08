import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Check if a canteen is currently open based on its opening hours.
 * The opening hours are in the format "6 PM - 2 AM".
 */
export function isCanteenOpen(timings: string): boolean {
  if (!timings) {
    return false;
  }

  // Parse the opening hours from the given format
  const [startStr, endStr] = timings.split('-').map(s => s.trim());

  // Parse the hours into date objects for today
  const now = new Date();
  const currentHour = now.getHours();

  // Convert 12-hour format to 24-hour numbers
  function parseTime(timeStr: string): number {
    const [hourStr, modifier] = timeStr.split(' ');
    let hour = parseInt(hourStr, 10);

    // Convert 12-hour to 24-hour format
    if (modifier === 'PM' && hour < 12) hour += 12;
    if (modifier === 'AM' && hour === 12) hour = 0;

    return hour;
  }

  const startHour = parseTime(startStr);
  let endHour = parseTime(endStr);

  // Handle cases like "10 PM - 2 AM" where end time is on the next day
  if (endHour < startHour) {
    endHour += 24;
  }

  // Convert current time to a comparable format
  let currentTimeInHours = currentHour;
  if (currentHour < startHour && currentHour < endHour % 24) {
    // It's early morning, need to add 24 to compare with late night hours
    currentTimeInHours += 24;
  }

  // Check if current time is between opening hours
  return currentTimeInHours >= startHour && currentTimeInHours < endHour;
}

/**
 * Format a date as a relative time string (e.g., "5 minutes ago", "2 days ago", "3 years ago")
 */
export function formatRelativeTime(date: Date | string | number): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();

  // Convert to seconds, minutes, hours, days, months, years
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSec < 60) {
    return diffSec <= 1 ? 'just now' : `${diffSec} seconds ago`;
  } else if (diffMin < 60) {
    return diffMin === 1 ? '1 minute ago' : `${diffMin} minutes ago`;
  } else if (diffHrs < 24) {
    return diffHrs === 1 ? '1 hour ago' : `${diffHrs} hours ago`;
  } else if (diffDays < 30) {
    return diffDays === 1 ? 'yesterday' : `${diffDays} days ago`;
  } else if (diffMonths < 12) {
    return diffMonths === 1 ? '1 month ago' : `${diffMonths} months ago`;
  } else {
    return diffYears === 1 ? '1 year ago' : `${diffYears} years ago`;
  }
}

/**
 * Format a date to show when a user joined (e.g., "Joined 3 years ago")
 */
export function formatJoinDate(date: Date | string | number): string {
  const now = new Date();
  const joinDate = new Date(date);
  const diffMs = now.getTime() - joinDate.getTime();

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffDays < 30) {
    return diffDays <= 1 ? 'Joined today' : `Joined ${diffDays} days ago`;
  } else if (diffMonths < 12) {
    return diffMonths === 1 ? 'Joined 1 month ago' : `Joined ${diffMonths} months ago`;
  } else {
    return diffYears === 1 ? 'Joined 1 year ago' : `Joined ${diffYears} years ago`;
  }
}
