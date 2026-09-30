import { Stack } from 'expo-router';
import React from 'react';

import { colors } from '@/lib/theme';

export default function FosterLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.cream },
      }}>
      <Stack.Screen name="wizard" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="update" />
    </Stack>
  );
}
