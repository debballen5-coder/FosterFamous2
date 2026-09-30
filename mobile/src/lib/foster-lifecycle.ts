import { normalizeFosterDate, normalizePersistedFosterDate } from './foster-date';
import type { AdoptionEvent, AdoptionStatus, Foster, FosterPeriod } from './types';

export function isAdoptedFoster(foster: Pick<Foster, 'adoptionStatus'>): boolean {
  return foster.adoptionStatus === 'Adopted';
}

export function isActiveFoster(foster: Pick<Foster, 'adoptionStatus'>): boolean {
  return !isAdoptedFoster(foster);
}

function periodId(
  fosterId: string,
  timestamp: string,
  existingPeriods: readonly FosterPeriod[] = []
): string {
  const base = `foster-period-${fosterId}-${timestamp}`;
  const existingIds = new Set(existingPeriods.map((period) => period.id));
  let candidate = base;
  let sequence = 2;
  while (existingIds.has(candidate)) {
    candidate = `${base}-${sequence}`;
    sequence += 1;
  }
  return candidate;
}

function adoptionEventId(periodIdValue: string): string {
  return `adoption-${periodIdValue}`;
}

function activePeriod(periods: readonly FosterPeriod[]): FosterPeriod | undefined {
  return [...periods].reverse().find((period) => period.status === 'Active' && !period.endedAt);
}

function latestCompletedPeriod(periods: readonly FosterPeriod[]): FosterPeriod | undefined {
  return [...periods].reverse().find((period) => period.status === 'Adopted');
}

function isOnOrAfter(date: string, minimum: string | null | undefined): boolean {
  return !minimum || date >= minimum;
}

/**
 * A profile can be added after a foster was already adopted. When that happens,
 * use the confirmed adoption date as the earliest reliable start for this
 * completed period instead of rejecting the historical record.
 */
function completedPeriodStart(startedAt: string | null | undefined, adoptedAt: string): string {
  return !startedAt || adoptedAt < startedAt ? adoptedAt : startedAt;
}

/** A return cannot predate the latest recorded adoption. */
export function canReactivateAfterAdoption(foster: Foster, returnedAt: string): boolean {
  return isOnOrAfter(returnedAt, latestCompletedPeriod(ensureFosterPeriods(foster))?.endedAt);
}

/**
 * Makes the current foster period explicit while preserving completed history.
 * `fosterStartDate` remains the original legacy intake date; after a return,
 * the active period itself is the authoritative current-period start date.
 */
export function ensureFosterPeriods(foster: Foster, now = new Date().toISOString()): FosterPeriod[] {
  const stored = Array.isArray(foster.fosterPeriods) ? foster.fosterPeriods : [];
  const normalizedStart = normalizePersistedFosterDate(foster.fosterStartDate);

  if (stored.length === 0) {
    return [{
      id: periodId(foster.id, now),
      startedAt: normalizedStart,
      // Do not invent an adoption date for legacy or incompletely entered records.
      endedAt: null,
      status: foster.adoptionStatus === 'Adopted' ? 'Adopted' : 'Active',
    }];
  }

  // Old records had a single profile-level intake date plus sometimes-stale nested metadata.
  // That legitimate profile date remains authoritative until an actual completed period proves
  // the foster has returned.
  const hasCompletedHistory = stored.some((period) => period.status === 'Adopted');
  // A single legacy record may have stale nested metadata, so its saved profile
  // start remains authoritative unless the confirmed adoption predates it. In that
  // case, the adoption date is the earliest reliable date for the completed stay.
  const canUseLegacyProfileStart = !hasCompletedHistory || stored.length === 1;
  return stored.map((period) => {
    const normalizedPeriodStart = normalizePersistedFosterDate(period.startedAt);
    const candidateEnd = period.endedAt ? normalizePersistedFosterDate(period.endedAt) : null;
    const preferredStart = canUseLegacyProfileStart && normalizedStart
      ? normalizedStart
      : normalizedPeriodStart;
    const startedAt = period.status === 'Adopted' && candidateEnd &&
      (!preferredStart || candidateEnd < preferredStart)
      ? candidateEnd
      : preferredStart;
    const endedAt = candidateEnd && (period.status === 'Adopted' || isOnOrAfter(candidateEnd, startedAt))
      ? candidateEnd
      : null;
    const status = period.status === 'Adopted' ? 'Adopted' : 'Active';
    return startedAt === period.startedAt && endedAt === period.endedAt && status === period.status
      ? period
      : { ...period, startedAt, endedAt, status };
  });
}

/** Adds missing event records for older completed periods without ever duplicating them. */
export function ensureAdoptionEvents(
  foster: Foster,
  periods = ensureFosterPeriods(foster),
  now = new Date().toISOString()
): AdoptionEvent[] {
  const existing = Array.isArray(foster.adoptionEvents) ? foster.adoptionEvents : [];
  const normalizedExisting = existing.map((event) => ({
    ...event,
    adoptedAt: event.adoptedAt ? normalizePersistedFosterDate(event.adoptedAt) : null,
  }));
  const knownPeriodIds = new Set(normalizedExisting.map((event) => event.fosterPeriodId));
  const inferred = periods
    .filter((period) => period.status === 'Adopted' && period.endedAt)
    .filter((period) => !knownPeriodIds.has(period.id))
    .map((period) => ({
      id: adoptionEventId(period.id),
      fosterPeriodId: period.id,
      adoptedAt: period.endedAt,
      createdAt: now,
    }));
  return [...normalizedExisting, ...inferred];
}

/**
 * Applies an adoption or return transition without discarding prior history.
 * Transition dates are user-confirmed local calendar dates. Missing or invalid dates
 * never fall back to today because a lifecycle record is historical fact.
 */
export function applyFosterLifecycle(
  existing: Foster | undefined,
  incoming: Foster,
  now = new Date().toISOString(),
  transitionDate?: string
): Foster {
  const previousStatus: AdoptionStatus | undefined = existing?.adoptionStatus;
  const nextIsAdopted = incoming.adoptionStatus === 'Adopted';
  const previousWasAdopted = previousStatus === 'Adopted';
  const incomingStart = normalizePersistedFosterDate(incoming.fosterStartDate);
  const confirmedTransitionDate = normalizeFosterDate(transitionDate);

  if (!existing) {
    let adoptionStatus = incoming.adoptionStatus;
    let fosterPeriods = ensureFosterPeriods({ ...incoming, fosterStartDate: incomingStart }, now);
    if (nextIsAdopted && confirmedTransitionDate) {
      fosterPeriods = fosterPeriods.map((period) => ({
        ...period,
        startedAt: completedPeriodStart(period.startedAt, confirmedTransitionDate),
        status: 'Adopted' as const,
        endedAt: confirmedTransitionDate,
      }));
    } else if (nextIsAdopted) {
      // New profiles must begin active unless the caller supplies the same
      // confirmed date required to complete a foster period.
      adoptionStatus = 'Not Yet Available';
      fosterPeriods = fosterPeriods.map((period) => ({ ...period, status: 'Active' as const }));
    }
    const fosterStartDate = nextIsAdopted && confirmedTransitionDate
      ? completedPeriodStart(incomingStart, confirmedTransitionDate)
      : incomingStart;
    const base: Foster = { ...incoming, adoptionStatus, fosterStartDate, fosterPeriods };
    return { ...base, adoptionEvents: ensureAdoptionEvents(base, fosterPeriods, now) };
  }

  let adoptionStatus = incoming.adoptionStatus;
  let fosterPeriods = ensureFosterPeriods(existing, now);
  const hasCompletedHistory = fosterPeriods.some((period) => period.status === 'Adopted');
  let fosterStartDate = hasCompletedHistory
    ? normalizePersistedFosterDate(existing.fosterStartDate)
    : incomingStart;
  let daysInFoster = incoming.daysInFoster;

  if (!previousWasAdopted && nextIsAdopted) {
    const current = activePeriod(fosterPeriods);
    if (confirmedTransitionDate) {
      const periodStart = completedPeriodStart(current?.startedAt ?? incomingStart, confirmedTransitionDate);
      fosterPeriods = current
        ? fosterPeriods.map((period) =>
            period.id === current.id
              ? { ...period, startedAt: periodStart, status: 'Adopted' as const, endedAt: confirmedTransitionDate }
              : period
          )
        : [...fosterPeriods, {
            id: periodId(incoming.id, now, fosterPeriods),
            startedAt: periodStart,
            endedAt: confirmedTransitionDate,
            status: 'Adopted',
          }];
      if (!hasCompletedHistory) {
        fosterStartDate = completedPeriodStart(incomingStart, confirmedTransitionDate);
      }
    } else {
      // Never report an adoption unless the same write closed its active period.
      adoptionStatus = previousStatus ?? 'Not Yet Available';
    }
  } else if (previousWasAdopted && !nextIsAdopted) {
    if (confirmedTransitionDate && canReactivateAfterAdoption(existing, confirmedTransitionDate) && !activePeriod(fosterPeriods)) {
      fosterPeriods = [...fosterPeriods, {
        id: periodId(incoming.id, now, fosterPeriods),
        startedAt: confirmedTransitionDate,
        endedAt: null,
        status: 'Active',
      }];
      daysInFoster = 0;
    } else {
      // Returns use the same date-validated lifecycle path; profile edits cannot reactivate a foster.
      adoptionStatus = previousStatus ?? 'Adopted';
    }
  } else if (nextIsAdopted) {
    // A correction on an adopted profile changes only its latest completed period,
    // and only when it remains chronologically valid.
    const completed = latestCompletedPeriod(fosterPeriods);
    if (completed && incomingStart !== completed.startedAt && (!completed.endedAt || isOnOrAfter(completed.endedAt, incomingStart))) {
      fosterPeriods = fosterPeriods.map((period) =>
        period.id === completed.id ? { ...period, startedAt: incomingStart } : period
      );
      if (!hasCompletedHistory) fosterStartDate = incomingStart;
    }
  } else {
    const current = activePeriod(fosterPeriods);
    if (current && current.startedAt !== incomingStart) {
      fosterPeriods = fosterPeriods.map((period) =>
        period.id === current.id ? { ...period, startedAt: incomingStart } : period
      );
    }
    if (!hasCompletedHistory) fosterStartDate = incomingStart;
  }

  const base: Foster = { ...incoming, adoptionStatus, fosterStartDate, daysInFoster, fosterPeriods };
  return { ...base, adoptionEvents: ensureAdoptionEvents(existing, fosterPeriods, now) };
}

export function completedFosterPeriods(foster: Foster): readonly FosterPeriod[] {
  return ensureFosterPeriods(foster).filter((period) => period.status === 'Adopted');
}

export function currentFosterPeriod(foster: Foster): FosterPeriod | undefined {
  const periods = ensureFosterPeriods(foster);
  return foster.adoptionStatus === 'Adopted'
    ? latestCompletedPeriod(periods)
    : activePeriod(periods);
}
