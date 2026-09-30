import { startOfDay } from 'date-fns';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import type { Foster } from './types';
import { calculateFosterDays, getFosterDuration, type FosterDuration } from './foster-duration';

type Listener = () => void;

const listeners = new Set<Listener>();
let currentDay = startOfDay(new Date()).getTime();
let midnightTimer: ReturnType<typeof setTimeout> | null = null;
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

function refreshCurrentDay() {
  const nextDay = startOfDay(new Date()).getTime();
  if (nextDay === currentDay) return;

  currentDay = nextDay;
  listeners.forEach((listener) => listener());
}

function scheduleMidnightRefresh() {
  if (midnightTimer) clearTimeout(midnightTimer);

  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);

  midnightTimer = setTimeout(() => {
    refreshCurrentDay();
    scheduleMidnightRefresh();
  }, nextMidnight.getTime() - now.getTime() + 100);
}

function startDayClock() {
  refreshCurrentDay();
  scheduleMidnightRefresh();
  appStateSubscription = AppState.addEventListener('change', (state) => {
    if (state !== 'active') return;
    refreshCurrentDay();
    scheduleMidnightRefresh();
  });
}

function stopDayClock() {
  if (midnightTimer) clearTimeout(midnightTimer);
  midnightTimer = null;
  appStateSubscription?.remove();
  appStateSubscription = null;
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  if (listeners.size === 1) startDayClock();

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stopDayClock();
  };
}

function getCurrentDay() {
  return currentDay;
}

export function useFosterDuration(foster: Foster): FosterDuration {
  const today = useSyncExternalStore(subscribe, getCurrentDay, getCurrentDay);
  return getFosterDuration(foster, new Date(today));
}

export function useDaysInFoster(foster: Foster): number | null {
  const today = useSyncExternalStore(subscribe, getCurrentDay, getCurrentDay);
  return calculateFosterDays(foster, new Date(today));
}
