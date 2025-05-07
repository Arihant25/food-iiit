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
  const currentMinutes = now.getMinutes();
  
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
