/**
 * Utility functions for formatting and parsing dates and times in Africa/Nairobi (UTC+3) timezone.
 */

export const NAIROBI_TIMEZONE = 'Africa/Nairobi';

/**
 * Returns a string in 'YYYY-MM-DDTHH:mm' suitable for <input type="datetime-local">,
 * explicitly converted to Africa/Nairobi local time.
 */
export function getNairobiDatetimeInputValue(dateInput?: string | Date | null): string {
  const d = dateInput
    ? typeof dateInput === 'string'
      ? new Date(dateInput)
      : dateInput
    : new Date();

  if (isNaN(d.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: NAIROBI_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/**
 * Returns a string in 'YYYY-MM-DD' suitable for <input type="date">,
 * explicitly in Africa/Nairobi local time.
 */
export function getNairobiDateInputValue(dateInput?: string | Date | null): string {
  const d = dateInput
    ? typeof dateInput === 'string'
      ? new Date(dateInput)
      : dateInput
    : new Date();

  if (isNaN(d.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: NAIROBI_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * Formats a date and time into consistent display format: "8 Nov 2026, 4:40 pm"
 * in Africa/Nairobi timezone.
 */
export function formatNairobiDateTime(dateInput?: string | Date | null, fallback: string = '—'): string {
  if (!dateInput) return fallback;
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return fallback;

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: NAIROBI_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(d);

  const day = parts.find((p) => p.type === 'day')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const year = parts.find((p) => p.type === 'year')?.value;
  const hour = parts.find((p) => p.type === 'hour')?.value;
  const minute = parts.find((p) => p.type === 'minute')?.value;
  const dayPeriod = parts.find((p) => p.type === 'dayPeriod')?.value.toLowerCase() || 'am';

  return `${day} ${month} ${year}, ${hour}:${minute} ${dayPeriod}`;
}

/**
 * Formats a date into consistent display format: "8 Nov 2026"
 * in Africa/Nairobi timezone.
 */
export function formatNairobiDate(dateInput?: string | Date | null, fallback: string = '—'): string {
  if (!dateInput) return fallback;
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return fallback;

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: NAIROBI_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).formatToParts(d);

  const day = parts.find((p) => p.type === 'day')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const year = parts.find((p) => p.type === 'year')?.value;

  return `${day} ${month} ${year}`;
}

/**
 * Formats only the time into consistent display format: "4:40 pm"
 * in Africa/Nairobi timezone.
 */
export function formatNairobiTime(dateInput?: string | Date | null, fallback: string = '—'): string {
  if (!dateInput) return fallback;
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return fallback;

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: NAIROBI_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(d);

  const hour = parts.find((p) => p.type === 'hour')?.value;
  const minute = parts.find((p) => p.type === 'minute')?.value;
  const dayPeriod = parts.find((p) => p.type === 'dayPeriod')?.value.toLowerCase() || 'am';

  return `${hour}:${minute} ${dayPeriod}`;
}
