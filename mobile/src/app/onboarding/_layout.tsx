import { Stack } from 'expo-router';
import React from 'react';

import { colors } from '@/lib/theme';

export const unstable_settings = {
  initialRouteName: 'welcome',
};

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.cream },
      }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="how-it-works" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="species" />
      <Stack.Screen name="help" />
      <Stack.Screen name="first-foster" />
    </Stack>
  );
}
