import { differenceInCalendarDays, startOfDay } from 'date-fns';

import { currentFosterPeriod } from './foster-lifecycle';
import { isFutureFosterDate, parseFosterDate } from './foster-date';
import type { Foster } from './types';

export { normalizeFosterDate, parseFosterDate } from './foster-date';

export type FosterDurationState =
  | 'valid'
  | 'missing-start-date'
  | 'invalid-start-date'
  | 'future-start-date'
  | 'missing-adoption-date'
  | 'invalid-adoption-date'
  | 'adoption-before-start';

export interface FosterDuration {
  days: number | null;
  state: FosterDurationState;
}

function invalidStartState(startDate: string | null | undefined, currentDate: Date): FosterDurationState | null {
  const value = startDate?.trim() ?? '';
  if (!value) return 'missing-start-date';
  if (!parseFosterDate(value)) return 'invalid-start-date';
  if (isFutureFosterDate(value, currentDate)) return 'future-start-date';
  return null;
}

/**
 * Calculates elapsed local calendar days from the canonical foster start date.
 * Active stays end on the current date; adopted stays end on their saved adoption date.
 */
export function getFosterDuration(foster: Foster, currentDate: Date = new Date()): FosterDuration {
  const period = currentFosterPeriod(foster);
  // A returned foster's new stay is represented by its active period, not by
  // the legacy profile-level original intake date.
  const startValue = period?.startedAt ?? foster.fosterStartDate;
  const startState = invalidStartState(startValue, currentDate);
  if (startState) {
    return foster.isDemo && startState === 'missing-start-date'
      ? { days: foster.daysInFoster, state: 'valid' }
      : { days: null, state: startState };
  }

  const startDate = parseFosterDate(startValue);
  if (!startDate) return { days: null, state: 'invalid-start-date' };

  const endValue = foster.adoptionStatus === 'Adopted'
    ? period?.endedAt
    : null;
  if (foster.adoptionStatus === 'Adopted' && !endValue?.trim()) {
    return { days: null, state: 'missing-adoption-date' };
  }

  const endDate = foster.adoptionStatus === 'Adopted'
    ? parseFosterDate(endValue)
    : startOfDay(currentDate);
  if (!endDate) return { days: null, state: 'invalid-adoption-date' };

  const days = differenceInCalendarDays(startOfDay(endDate), startOfDay(startDate));
  if (days < 0) return { days: null, state: 'adoption-before-start' };

  return { days, state: 'valid' };
}

/** Compatibility helper for existing consumers that only need a number. */
export function calculateFosterDays(foster: Foster, currentDate: Date = new Date()): number | null {
  return getFosterDuration(foster, currentDate).days;
}

/**
 * Legacy compatibility helper. Real-foster UI must use getFosterDuration so it
 * can distinguish missing and invalid dates from a genuine same-day stay.
 */
export function calculateDaysInFoster(
  fosterStartDate: string | null,
  fallbackDays: number,
  currentDate: Date = new Date()
): number {
  const parsedStart = parseFosterDate(fosterStartDate);
  if (!parsedStart || isFutureFosterDate(fosterStartDate, currentDate)) return fallbackDays;
  return differenceInCalendarDays(startOfDay(currentDate), startOfDay(parsedStart));
}

export function fosterDurationLabel(duration: FosterDuration, adopted: boolean): string {
  if (duration.state === 'valid' && duration.days !== null) {
    if (duration.days === 0) return adopted ? 'Same-day foster period' : 'Started today';
    const unit = duration.days === 1 ? 'day' : 'days';
    return adopted
      ? `${duration.days} ${unit} foster period`
      : `${duration.days} ${unit} in foster`;
  }

  switch (duration.state) {
    case 'missing-start-date':
      return 'Start date not set';
    case 'invalid-start-date':
    case 'future-start-date':
      return 'Start date needs correction';
    case 'missing-adoption-date':
      return 'Adoption date not set';
    case 'invalid-adoption-date':
    case 'adoption-before-start':
      return 'Adoption date needs correction';
    default:
      return 'Start date needs correction';
  }
}
