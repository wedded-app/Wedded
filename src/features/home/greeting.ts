/** The greeting for the time of day, as a key under home.greeting (add "Plain" when there's no name). */
export function greetingKey(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return 'home.greeting.morning';
  if (hour < 17) return 'home.greeting.afternoon';
  return 'home.greeting.evening';
}

/** Today above the greeting, in small capitals: "THURSDAY · OCT 22". */
export function todayLine(now: Date): string {
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
  const month = now.toLocaleDateString('en-US', { month: 'short' });
  return `${weekday} · ${month} ${now.getDate()}`.toUpperCase();
}

/** "2027-06-11" as JUN, 11 and FRI for a ticket's stub. */
export function stubParts(
  date: string | null,
): { month: string; day: string; weekday: string } | null {
  if (!date) return null;
  const [y, m, d] = date.split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1, d));
  const part = (options: Intl.DateTimeFormatOptions) =>
    at.toLocaleDateString('en-US', { timeZone: 'UTC', ...options }).toUpperCase();
  return { month: part({ month: 'short' }), day: String(d), weekday: part({ weekday: 'short' }) };
}
