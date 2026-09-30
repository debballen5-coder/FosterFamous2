import { Stack } from 'expo-router';
import React from 'react';

import { colors } from '@/lib/theme';

export default function InfoLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.cream },
      }}>
      <Stack.Screen name="[slug]" />
    </Stack>
  );
}
