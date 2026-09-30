import {
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import {
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { installLogBoxLocationGuard } from '@/lib/install-logbox-location-guard';
import { useAppStore } from '@/lib/state/app-store';
import { colors } from '@/lib/theme';

export const unstable_settings = {
  initialRouteName: 'index',
};

installLogBoxLocationGuard();

// Prevent the splash screen from auto-hiding before asset loading is complete.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient();

/** Foster Famous uses a warm, intentional light-mode interface. */
const fosterFamousTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.cream,
    card: colors.white,
    text: colors.ink,
    primary: colors.forest,
    border: colors.hairline,
  },
};

function RootLayoutNav() {
  return (
    <ThemeProvider value={fosterFamousTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: colors.cream },
        }}>
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="foster" />
        <Stack.Screen name="media/[id]" />
        <Stack.Screen name="create" />
        <Stack.Screen name="share" />
        <Stack.Screen name="tools" />
        <Stack.Screen name="adoption-boost" />
        <Stack.Screen name="info" />
      </Stack>
    </ThemeProvider>
  );
}

function RootLayoutContent() {
  const hydrated = useAppStore((s) => s.hydrated);
  const reconciliationStarted = useRef<boolean>(false);
  const reconcileMediaMutation = useMutation({
    mutationFn: async () => {
      const state = useAppStore.getState();
      await state.ensureDurableMediaCopies();
      await Promise.all([
        ...state.fosters.map((foster) => state.ensureFosterProfileMedia(foster.id)),
        ...state.contentPosts.map((post) => state.ensureContentPostMedia(post.id)),
      ]);
    },
  });
  const { mutate: reconcileMedia } = reconcileMediaMutation;

  const [fontsLoaded, fontError] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  const ready = (fontsLoaded || !!fontError) && hydrated;

  useEffect(() => {
    if (!hydrated || reconciliationStarted.current) return;
    reconciliationStarted.current = true;
    reconcileMedia();
  }, [hydrated, reconcileMedia]);

  const onLayout = useCallback(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  // Keep the splash visible until fonts and persisted state are both in.
  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <View style={{ flex: 1, backgroundColor: colors.cream }} onLayout={onLayout}>
          <StatusBar style="dark" />
          <RootLayoutNav />
        </View>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <RootLayoutContent />
    </QueryClientProvider>
  );
}
