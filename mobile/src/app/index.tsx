import { Redirect } from 'expo-router';
import React from 'react';

import { useAppStore } from '@/lib/state/app-store';

/**
 * Entry gate. First launch goes to the welcome flow; returning users land
 * straight on Home. Persisted state is already hydrated by the root layout,
 * so this decision never flickers.
 */
export default function Index() {
  const onboardingComplete = useAppStore((s) => s.onboardingComplete);

  return <Redirect href={onboardingComplete ? '/(tabs)/home' : '/onboarding/welcome'} />;
}
