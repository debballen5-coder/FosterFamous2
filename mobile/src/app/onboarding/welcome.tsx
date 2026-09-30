import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Heart, PawPrint } from 'lucide-react-native';
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { PawPattern } from '@/components/PawPattern';
import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/Pressables';
import { Screen } from '@/components/ui/Screen';
import { colors, liftedShadow, softShadow } from '@/lib/theme';

const DOG_PHOTO =
  'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=900&q=80';
const CAT_PHOTO =
  'https://images.unsplash.com/photo-1495360010541-f48722b34f7d?auto=format&fit=crop&w=900&q=80';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <Screen testID="welcome-screen" edges={['top', 'bottom']}>
      <PawPattern color={colors.forest} height={420} />

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}>
        {/* Wordmark */}
        <Animated.View entering={FadeInDown.duration(500)} className="flex-row items-center pt-2">
          <View
            className="h-9 w-9 items-center justify-center rounded-2xl bg-forest"
            style={softShadow}>
            <PawPrint size={19} color={colors.cream} strokeWidth={2.4} />
          </View>
          <Text className="ml-2.5 font-display text-xl text-forest">Foster Famous</Text>
        </Animated.View>

        {/* Hero: two overlapping portraits, a dog and a cat */}
        <Animated.View
          entering={FadeInUp.delay(120).duration(650)}
          className="mt-7 h-[258px] items-center justify-center">
          <View
            className="absolute left-2 top-6 h-[172px] w-[172px] overflow-hidden rounded-full border-4 border-cream"
            style={liftedShadow}>
            <Image
              source={{ uri: CAT_PHOTO }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              transition={400}
            />
          </View>
          <View
            className="absolute right-1 top-0 h-[196px] w-[196px] overflow-hidden rounded-full border-4 border-cream"
            style={liftedShadow}>
            <Image
              source={{ uri: DOG_PHOTO }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              transition={400}
            />
          </View>
          <View
            className="absolute bottom-3 left-1/2 -ml-[86px] h-11 flex-row items-center rounded-full bg-clay px-4"
            style={liftedShadow}>
            <Heart size={15} color={colors.white} strokeWidth={2.8} fill={colors.white} />
            <Text className="ml-2 font-extrabold text-base text-white">
              2 pets waiting on you
            </Text>
          </View>
        </Animated.View>

        {/* Message */}
        <Animated.View entering={FadeInDown.delay(240).duration(600)} className="mt-8">
          <Text className="font-extrabold text-xs uppercase tracking-[2px] text-clay-deep">
            Foster Famous
          </Text>
          <Text className="mt-2.5 font-display text-4xl leading-[44px] text-forest">
            Help Your Foster Pet Get Noticed, Shared & Adopted
          </Text>
          <Text className="mt-4 font-sans text-lg leading-[26px] text-ink-soft">
            You don’t need to be a marketer. Foster Famous gives you simple daily ideas, practical
            tools, and ready-to-use guidance to help your foster pet find the right home.
          </Text>
        </Animated.View>

        <View className="flex-1" />

        {/* Actions */}
        <Animated.View entering={FadeInDown.delay(380).duration(600)} className="mt-10">
          <Button
            testID="get-started-button"
            label="Get Started"
            size="lg"
            onPress={() => router.push('/onboarding/species')}
          />
          <PressableScale
            testID="see-how-it-works-button"
            accessibilityRole="button"
            haptic={false}
            onPress={() => router.push('/onboarding/how-it-works')}
            className="mt-3 h-12 items-center justify-center">
            <Text className="font-bold text-lg text-forest underline">See How It Works</Text>
          </PressableScale>
          <Text className="mt-4 text-center font-sans text-sm text-ink-muted">
            No account needed to look around.
          </Text>
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}
