import { useRouter } from 'expo-router';
import { Compass, PawPrint } from 'lucide-react-native';
import React from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/lib/theme';

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <Screen testID="not-found-screen" edges={['top', 'bottom']}>
      <View className="flex-1 items-center justify-center px-6">
        <View className="h-20 w-20 items-center justify-center rounded-[32px] bg-forest-soft">
          <Compass size={34} color={colors.forest} strokeWidth={2} />
        </View>
        <Text className="mt-6 text-center font-display text-3xl text-forest">We couldn’t find that page.</Text>
        <Text className="mt-3 text-center font-sans text-lg leading-[25px] text-ink-soft">Your foster information is safe.</Text>
        <View className="mt-8 w-full gap-3">
          <Button testID="not-found-go-home" label="Go Home" onPress={() => router.replace('/(tabs)/home')} />
          <Button testID="not-found-view-fosters" label="View Fosters" variant="secondary" icon={<PawPrint size={18} color={colors.forest} strokeWidth={2.3} />} onPress={() => router.replace('/(tabs)/fosters')} />
        </View>
      </View>
    </Screen>
  );
}
