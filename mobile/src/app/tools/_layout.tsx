import { Stack } from 'expo-router';
import React from 'react';

import { colors } from '@/lib/theme';

export default function ToolsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.cream },
      }}>
      <Stack.Screen name="photo-coach" />
      <Stack.Screen name="video-coach" />
      <Stack.Screen name="marketing-tracker" />
      <Stack.Screen name="hard-to-place" />
    </Stack>
  );
}
