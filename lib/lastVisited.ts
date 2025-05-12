"use client";

// Constants for the cookie name and options
const LAST_VISITED_COOKIE = "food_iiit_last_visited";

/**
 * Get the user's last visited page (canteen or mess)
 * @returns {string} The last visited page or 'canteen' as default
 */
export function getLastVisitedPage(): string {
    // Only run in browser
    if (typeof document === "undefined") return "canteen";

    // Get the cookie value
    const cookieValue = getCookie(LAST_VISITED_COOKIE);

    // Return the value or default to 'canteen'
    return cookieValue === "mess" ? "mess" : "canteen";
}

/**
 * Save the user's last visited page
 * @param {string} page - The page name (should be 'canteen' or 'mess')
 */
export function saveLastVisitedPage(page: string): void {
    // Only run in browser
    if (typeof document === "undefined") return;

    // Validate the page name
    const validPage = page === "mess" ? "mess" : "canteen";

    // Set the cookie (30 days expiry)
    setCookie(LAST_VISITED_COOKIE, validPage, 30);
}

/**
 * Set a cookie
 * @param {string} name - The name of the cookie
 * @param {string} value - The value of the cookie
 * @param {number} days - The number of days until the cookie expires
 */
function setCookie(name: string, value: string, days: number): void {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = `expires=${date.toUTCString()}`;
    document.cookie = `${name}=${value};${expires};path=/;SameSite=Lax`;
}

/**
 * Get a cookie value by name
 * @param {string} name - The name of the cookie
 * @returns {string} The cookie value or empty string if not found
 */
function getCookie(name: string): string {
    const nameEQ = `${name}=`;
    const cookies = document.cookie.split(';');

    for (let i = 0; i < cookies.length; i++) {
        let cookie = cookies[i].trim();
        if (cookie.indexOf(nameEQ) === 0) {
            return cookie.substring(nameEQ.length, cookie.length);
        }
    }

    return "";
}
