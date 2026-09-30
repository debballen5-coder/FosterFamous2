import { useRouter } from 'expo-router';
import { Cat, Check, Dog, PawPrint } from 'lucide-react-native';
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/Pressables';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { cn } from '@/lib/cn';
import { useAppStore } from '@/lib/state/app-store';
import { colors, softShadow } from '@/lib/theme';
import type { FosterPreference } from '@/lib/types';

const OPTIONS: { value: FosterPreference; label: string; blurb: string; Icon: typeof Dog }[] = [
  { value: 'dogs', label: 'Dogs', blurb: 'Puppies, adults, and seniors', Icon: Dog },
  { value: 'cats', label: 'Cats', blurb: 'Kittens, adults, and seniors', Icon: Cat },
  { value: 'both', label: 'Both', blurb: 'A little of everything', Icon: PawPrint },
];

export default function SpeciesScreen() {
  const router = useRouter();
  const preference = useAppStore((s) => s.fosterPreference);
  const setFosterPreference = useAppStore((s) => s.setFosterPreference);

  return (
    <Screen testID="species-screen" edges={['top', 'bottom']}>
      <ScreenHeader subtitle="Step 1 of 3" />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}>
        <Text className="mt-2 font-display text-3xl leading-[40px] text-forest">
          What do you foster?
        </Text>
        <Text className="mt-2.5 font-sans text-lg leading-[25px] text-ink-soft">
          This shapes the photo tips, post ideas, and bios we suggest.
        </Text>

        <View className="mt-8">
          {OPTIONS.map((option, i) => {
            const selected = preference === option.value;
            const Icon = option.Icon;
            return (
              <Animated.View key={option.value} entering={FadeInDown.delay(80 * i).duration(450)}>
                <PressableScale
                  testID={`species-option-${option.value}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={option.label}
                  onPress={() => setFosterPreference(option.value)}
                  scaleTo={0.98}
                  haptic="medium"
                  style={softShadow}
                  className={cn(
                    'mb-4 flex-row items-center rounded-4xl border-2 p-5',
                    selected ? 'border-forest bg-forest' : 'border-transparent bg-white'
                  )}>
                  <View
                    className={cn(
                      'h-14 w-14 items-center justify-center rounded-3xl',
                      selected ? 'bg-cream/20' : 'bg-forest-soft'
                    )}>
                    <Icon
                      size={27}
                      color={selected ? colors.cream : colors.forest}
                      strokeWidth={2.1}
                    />
                  </View>
                  <View className="ml-4 flex-1">
                    <Text
                      className={cn(
                        'font-display text-2xl',
                        selected ? 'text-cream' : 'text-forest'
                      )}>
                      {option.label}
                    </Text>
                    <Text
                      className={cn(
                        'mt-0.5 font-sans text-base',
                        selected ? 'text-cream/75' : 'text-ink-muted'
                      )}>
                      {option.blurb}
                    </Text>
                  </View>
                  <View
                    className={cn(
                      'h-7 w-7 items-center justify-center rounded-full border-2',
                      selected ? 'border-cream bg-cream' : 'border-beige-dark'
                    )}>
                    {selected ? (
                      <Check size={16} color={colors.forest} strokeWidth={3.4} />
                    ) : null}
                  </View>
                </PressableScale>
              </Animated.View>
            );
          })}
        </View>

        <View className="flex-1" />

        <Button
          testID="species-continue"
          label="Continue"
          disabled={!preference}
          className="mt-8"
          onPress={() => router.push('/onboarding/help')}
        />
      </ScrollView>
    </Screen>
  );
}
