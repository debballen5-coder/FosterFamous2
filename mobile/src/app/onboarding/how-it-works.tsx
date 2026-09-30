import { useRouter } from 'expo-router';
import {
  Camera,
  CalendarCheck,
  LineChart,
  PawPrint,
  Sparkles,
  X,
} from 'lucide-react-native';
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/Pressables';
import { Screen } from '@/components/ui/Screen';
import { goBackOrReplace } from '@/lib/navigation';
import { colors, softShadow } from '@/lib/theme';

const STEPS = [
  {
    icon: PawPrint,
    title: 'Add your foster',
    body: 'Tell us what you actually know about them. We never make things up about a real animal.',
  },
  {
    icon: Sparkles,
    title: 'Get a daily mission',
    body: 'One small, specific thing to post today. No blank page, no guessing.',
  },
  {
    icon: Camera,
    title: 'Take better photos',
    body: 'A checklist of the shots adopters actually respond to, with setup tips for each.',
  },
  {
    icon: CalendarCheck,
    title: 'Follow a 30-day plan',
    body: 'A simple promotion routine you can do in ten minutes a day.',
  },
  {
    icon: LineChart,
    title: 'See what’s working',
    body: 'Track views, shares, and applications so you can do more of what lands.',
  },
];

export default function HowItWorksScreen() {
  const router = useRouter();

  return (
    <Screen testID="how-it-works-screen" edges={['top', 'bottom']}>
      <View className="flex-row items-center justify-between px-5 pt-2">
        <Text className="font-display text-xl text-forest">How It Works</Text>
        <PressableScale
          testID="close-how-it-works"
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => goBackOrReplace(router, '/onboarding/welcome')}
          scaleTo={0.9}
          className="h-11 w-11 items-center justify-center rounded-full border border-hairline bg-white">
          <X size={20} color={colors.forest} strokeWidth={2.4} />
        </PressableScale>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}>
        <Text className="mb-7 font-sans text-lg leading-[26px] text-ink-soft">
          Five simple habits, and Foster Famous walks you through each one.
        </Text>

        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <Animated.View
              key={step.title}
              entering={FadeInDown.delay(60 * i).duration(450)}
              className="mb-3.5 flex-row rounded-4xl border border-hairline/60 bg-white p-4"
              style={softShadow}>
              <View className="mr-4 h-12 w-12 items-center justify-center rounded-2xl bg-forest-soft">
                <Icon size={22} color={colors.forest} strokeWidth={2.2} />
              </View>
              <View className="flex-1">
                <View className="mb-1 flex-row items-center">
                  <Text className="mr-2 font-extrabold text-xs tracking-[1.4px] text-clay-deep">
                    {String(i + 1).padStart(2, '0')}
                  </Text>
                  <Text className="font-bold text-lg text-ink">{step.title}</Text>
                </View>
                <Text className="font-sans text-base leading-[21px] text-ink-muted">
                  {step.body}
                </Text>
              </View>
            </Animated.View>
          );
        })}

        <View className="mt-4 rounded-4xl bg-forest p-5">
          <Text className="mb-1.5 font-display text-xl text-cream">
            Everything stays accurate
          </Text>
          <Text className="font-sans text-base leading-[22px] text-cream/80">
            Foster Famous only writes from what you record. If something is unknown, it stays
            unknown — no invented temperament, no invented medical history, ever.
          </Text>
        </View>

        <Button
          testID="how-it-works-continue"
          label="Got It"
          className="mt-7"
          onPress={() => goBackOrReplace(router, '/onboarding/welcome')}
        />
      </ScrollView>
    </Screen>
  );
}
