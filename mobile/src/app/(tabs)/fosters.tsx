import { useRouter } from 'expo-router';
import { Plus, Sparkle, Trophy } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { DemoNotice } from '@/components/DemoBadge';
import { FosterListCard } from '@/components/FosterCard';
import { PressableScale } from '@/components/ui/Pressables';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { cn } from '@/lib/cn';
import { useDisplayFosters } from '@/lib/state/app-store';
import { colors, softShadow } from '@/lib/theme';

type TabKey = 'active' | 'adopted';

export default function FostersScreen() {
  const router = useRouter();
  const fosters = useDisplayFosters();
  const [tab, setTab] = useState<TabKey>('active');

  const active = useMemo(
    () => fosters.filter((f) => f.adoptionStatus !== 'Adopted'),
    [fosters]
  );
  const adopted = useMemo(
    () => fosters.filter((f) => f.adoptionStatus === 'Adopted'),
    [fosters]
  );

  const showingSamples = fosters.some((f) => f.isDemo);

  return (
    <Screen testID="fosters-screen">
      <View className="flex-row items-center justify-between px-5 pb-4 pt-2">
        <View className="flex-1">
          <Text className="font-display text-3xl text-forest">My Foster Pets</Text>
          <Text className="mt-0.5 font-sans text-base text-ink-muted">
            {active.length} active · {adopted.length} adopted
          </Text>
        </View>
        <PressableScale
          testID="add-foster-button"
          accessibilityRole="button"
          accessibilityLabel="Add Foster"
          onPress={() => router.push('/foster/wizard')}
          scaleTo={0.94}
          style={softShadow}
          className="h-12 flex-row items-center rounded-full bg-forest px-4">
          <Plus size={17} color={colors.cream} strokeWidth={3} />
          <Text className="ml-1.5 font-bold text-base text-cream">Add Foster</Text>
        </PressableScale>
      </View>

      {/* Segmented switch */}
      <View className="mx-5 mb-4 flex-row rounded-full border border-hairline bg-white p-1">
        {(
          [
            { key: 'active' as TabKey, label: 'Active Fosters' },
            { key: 'adopted' as TabKey, label: 'Adopted / Archived' },
          ]
        ).map(({ key, label }) => (
          <PressableScale
            key={key}
            testID={`fosters-tab-${key}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
            onPress={() => setTab(key)}
            scaleTo={0.97}
            className={cn(
              'h-11 flex-1 items-center justify-center rounded-full',
              tab === key ? 'bg-forest' : 'bg-transparent'
            )}>
            <Text
              className={cn(
                'font-bold text-base',
                tab === key ? 'text-cream' : 'text-ink-muted'
              )}>
              {label}
            </Text>
          </PressableScale>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}>
        {showingSamples && tab === 'active' ? (
          <View className="mb-4">
            <DemoNotice text="Winston and Marigold are samples so you can see how this looks. Add your own foster to replace them." />
          </View>
        ) : null}

        {tab === 'active' ? (
          active.length > 0 ? (
            active.map((foster, i) => (
              <Animated.View key={foster.id} entering={FadeInDown.delay(60 * i).duration(420)}>
                <FosterListCard
                  foster={foster}
                  onPress={() => router.push(`/foster/${foster.id}`)}
                />
              </Animated.View>
            ))
          ) : (
            <EmptyState
              testID="no-fosters-empty"
              icon={<Sparkle size={26} color={colors.forest} strokeWidth={2.2} />}
              title="No fosters yet."
              body="Add your first foster and we’ll help you start telling their story."
              actionLabel="Add Foster"
              onAction={() => router.push('/foster/wizard')}
            />
          )
        ) : adopted.length > 0 ? (
          adopted.map((foster, i) => (
            <Animated.View key={foster.id} entering={FadeInDown.delay(60 * i).duration(420)}>
              <FosterListCard
                foster={foster}
                onPress={() => router.push(`/foster/${foster.id}`)}
              />
            </Animated.View>
          ))
        ) : (
          <EmptyState
            testID="no-adopted-empty"
            icon={<Trophy size={26} color={colors.forest} strokeWidth={2.2} />}
            title="Your adopted fosters will live here."
            body="Completed foster journeys remain here with their media, posts, and history — ready if a foster ever returns."
          />
        )}
      </ScrollView>
    </Screen>
  );
}
