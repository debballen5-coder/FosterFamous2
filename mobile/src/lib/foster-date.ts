import { format, isValid, parse, parseISO, startOfDay } from 'date-fns';

/**
 * Foster dates are calendar dates, not instants. New records always persist this
 * local-date representation so a device timezone cannot move an intake day.
 */
export const FOSTER_DATE_FORMAT = 'yyyy-MM-dd';

const DATE_ONLY_FORMATS = [
  FOSTER_DATE_FORMAT,
  'yyyy-M-d',
  'MMM d, yyyy',
  'MMM d,yyyy',
  'MMMM d, yyyy',
  'MMMM d,yyyy',
  'M/d/yyyy',
  'MM/dd/yyyy',
] as const;

function normalizedInput(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/(\d{1,2})(st|nd|rd|th)\b/gi, '$1')
    .replace(/\bsept\.?\b/gi, 'Sep')
    .replace(/^([A-Za-z]+ \d{1,2})\s*,?\s*(\d{4})$/, '$1, $2')
    .replace(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/, '$1-$2-$3')
    .replace(/^(\d{1,2})[.-](\d{1,2})[.-](\d{4})$/, '$1/$2/$3');
}

/** Parses both canonical dates and legacy user-entered values as local calendar dates. */
export function parseFosterDate(value: string | null | undefined): Date | null {
  const input = value?.trim() ?? '';
  if (!input) return null;

  const normalized = normalizedInput(input);
  for (const dateFormat of DATE_ONLY_FORMATS) {
    const parsed = parse(normalized, dateFormat, new Date());
    if (isValid(parsed)) return startOfDay(parsed);
  }

  const parsedIso = parseISO(normalized);
  return isValid(parsedIso) ? startOfDay(parsedIso) : null;
}

/** Converts a parsable foster date to the sole persisted date format. */
export function normalizeFosterDate(value: string | null | undefined): string | null {
  const parsed = parseFosterDate(value);
  return parsed ? format(parsed, FOSTER_DATE_FORMAT) : null;
}

/** Keeps an invalid legacy value visible for correction instead of silently discarding it. */
export function normalizePersistedFosterDate(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return null;
  return normalizeFosterDate(trimmed) ?? trimmed;
}

/** Converts a time-stamped lifecycle value into its local calendar day. */
export function calendarDateFromTimestamp(value: string | null | undefined): string | null {
  return normalizeFosterDate(value);
}

export function isFutureFosterDate(value: string | null | undefined, today = new Date()): boolean {
  const parsed = parseFosterDate(value);
  return Boolean(parsed && parsed.getTime() > startOfDay(today).getTime());
}
