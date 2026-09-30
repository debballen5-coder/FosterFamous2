import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Camera, FileText, Sparkles } from 'lucide-react-native';
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { PawPattern } from '@/components/PawPattern';
import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/Pressables';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { useAppStore } from '@/lib/state/app-store';
import { colors, liftedShadow } from '@/lib/theme';

const HERO =
  'https://images.unsplash.com/photo-1568572933382-74d440642117?auto=format&fit=crop&w=1000&q=80';

const PERKS = [
  { Icon: Sparkles, label: 'Daily post ideas made for them' },
  { Icon: Camera, label: 'Photo and video goals to work through' },
  { Icon: FileText, label: 'An adoption bio written from your notes' },
];

export default function FirstFosterScreen() {
  const router = useRouter();
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);

  const goToWizard = () => {
    completeOnboarding();
    router.replace('/foster/wizard');
  };

  const skip = () => {
    completeOnboarding();
    router.replace('/(tabs)/home');
  };

  return (
    <Screen testID="first-foster-screen" edges={['top', 'bottom']}>
      <PawPattern color={colors.clay} height={340} />
      <ScreenHeader subtitle="Step 3 of 3" />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}>
        <Animated.View
          entering={FadeInUp.duration(600)}
          className="mt-3 h-[210px] w-full overflow-hidden rounded-5xl"
          style={liftedShadow}>
          <Image
            source={{ uri: HERO }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={400}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(550)} className="mt-7">
          <Text className="font-display text-3xl leading-[40px] text-forest">
            Let’s make your foster famous.
          </Text>
          <Text className="mt-3 font-sans text-lg leading-[26px] text-ink-soft">
            Add a foster pet so Foster Famous can tailor post ideas, photo
            goals, bios, and promotion plans.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(280).duration(550)} className="mt-7">
          {PERKS.map(({ Icon, label }) => (
            <View key={label} className="mb-3 flex-row items-center">
              <View className="h-10 w-10 items-center justify-center rounded-2xl bg-clay-soft">
                <Icon size={19} color={colors.clayDeep} strokeWidth={2.3} />
              </View>
              <Text className="ml-3.5 flex-1 font-semibold text-lg text-ink">{label}</Text>
            </View>
          ))}
        </Animated.View>

        <View className="flex-1" />

        <Animated.View entering={FadeInDown.delay(400).duration(550)} className="mt-9">
          <Button
            testID="add-my-foster-button"
            label="Add My Foster Pet"
            onPress={goToWizard}
          />
          <PressableScale
            testID="skip-for-now-button"
            accessibilityRole="button"
            haptic={false}
            onPress={skip}
            className="mt-3 h-12 items-center justify-center">
            <Text className="font-bold text-lg text-forest underline">Skip for Now</Text>
          </PressableScale>
          <Text className="mt-3.5 text-center font-sans text-sm text-ink-muted">
            Skipping shows you a sample pet named Winston so you can look around. He’s clearly
            labelled as a sample and never saved as your foster.
          </Text>
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}
