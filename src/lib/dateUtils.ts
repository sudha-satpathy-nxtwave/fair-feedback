/**
 * Returns today's date as YYYY-MM-DD in the user's LOCAL timezone.
 * This avoids the UTC offset bug where `new Date().toISOString()` returns the
 * previous/next day for users in non-UTC timezones.
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns the current local timestamp in readable format (YYYY-MM-DD HH:MM:SS)
 * matching the user's local timezone for perfect spreadsheet logging.
 */
export function getLocalTimestampString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/** Get an array of the last N local-date strings, ascending (oldest → newest). */
export function getLastNDates(n: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(getLocalDateString(d));
  }
  return dates;
}
