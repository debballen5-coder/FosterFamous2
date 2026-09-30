import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/Pressables';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { cn } from '@/lib/cn';
import { HELP_TOPICS } from '@/lib/options';
import { useAppStore } from '@/lib/state/app-store';
import { colors, softShadow } from '@/lib/theme';

export default function HelpScreen() {
  const router = useRouter();
  const helpTopics = useAppStore((s) => s.helpTopics);
  const toggleHelpTopic = useAppStore((s) => s.toggleHelpTopic);

  return (
    <Screen testID="help-screen" edges={['top', 'bottom']}>
      <ScreenHeader subtitle="Step 2 of 3" />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}>
        <Text className="mt-2 font-display text-3xl leading-[40px] text-forest">
          What would you like help with?
        </Text>
        <Text className="mt-2.5 font-sans text-lg leading-[25px] text-ink-soft">
          Pick as many as you like. You can change these any time.
        </Text>

        <View className="mt-7">
          {HELP_TOPICS.map((topic, i) => {
            const selected = helpTopics.includes(topic);
            return (
              <Animated.View key={topic} entering={FadeInDown.delay(45 * i).duration(400)}>
                <PressableScale
                  testID={`help-topic-${i}`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={topic}
                  onPress={() => toggleHelpTopic(topic)}
                  scaleTo={0.985}
                  style={selected ? softShadow : undefined}
                  className={cn(
                    'mb-3 min-h-[62px] flex-row items-center rounded-3xl border px-4 py-3',
                    selected ? 'border-forest bg-white' : 'border-hairline bg-white/70'
                  )}>
                  <View
                    className={cn(
                      'mr-3.5 h-7 w-7 items-center justify-center rounded-full border-2',
                      selected ? 'border-forest bg-forest' : 'border-beige-dark'
                    )}>
                    {selected ? (
                      <Check size={16} color={colors.cream} strokeWidth={3.2} />
                    ) : null}
                  </View>
                  <Text
                    className={cn(
                      'flex-1 text-lg',
                      selected ? 'font-bold text-forest' : 'font-semibold text-ink-soft'
                    )}>
                    {topic}
                  </Text>
                </PressableScale>
              </Animated.View>
            );
          })}
        </View>

        <Text className="mb-5 mt-2 text-center font-sans text-sm text-ink-muted">
          {helpTopics.length > 0
            ? `${helpTopics.length} selected`
            : 'Skip ahead if you’d rather explore first.'}
        </Text>

        <Button
          testID="help-continue"
          label="Continue"
          onPress={() => router.push('/onboarding/first-foster')}
        />
      </ScrollView>
    </Screen>
  );
}
