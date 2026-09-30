import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Cat, Dog } from 'lucide-react-native';
import React from 'react';
import { Text, View } from 'react-native';

import { formatActivityDate } from '@/lib/foster-activity';
import { calculateFosterFamousScore } from '@/lib/foster-score';
import { useAppStore } from '@/lib/state/app-store';
import { useRecentFosterActivity } from '@/lib/use-foster-activity';
import { fosterDurationLabel } from '@/lib/foster-duration';
import { colors, liftedShadow, softShadow } from '@/lib/theme';
import type { Foster } from '@/lib/types';
import { useFosterDuration } from '@/lib/use-days-in-foster';

import { DemoBadge } from './DemoBadge';
import { PressableScale } from './ui/Pressables';
import { ProgressBar } from './ui/Progress';
import { placementStatusLabel, StatusBadge } from './ui/StatusBadge';

function SpeciesIcon({ species, color }: { species: Foster['species']; color: string }) {
  return species === 'cat' ? (
    <Cat size={13} color={color} strokeWidth={2.4} />
  ) : (
    <Dog size={13} color={color} strokeWidth={2.4} />
  );
}

/**
 * The hero card on Home. Photo-forward with the name set over a dark scrim —
 * this is the one place the app goes big, because the animal is the point.
 */
export function ActiveFosterCard({
  foster,
  onPress,
  width,
}: {
  foster: Foster;
  onPress?: () => void;
  width?: number;
}) {
  const fosterDuration = useFosterDuration(foster);
  const recentActivity = useRecentFosterActivity(foster);

  return (
    <PressableScale
      testID={`active-foster-card-${foster.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${foster.name}, ${placementStatusLabel(foster.adoptionStatus)}`}
      onPress={onPress}
      scaleTo={0.98}
      style={[{ width }, liftedShadow]}
      className="overflow-hidden rounded-4xl bg-forest">
      <View className="h-[240px] w-full">
        {foster.photoUri ? (
          <Image
            source={{ uri: foster.photoUri }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={280}
          />
        ) : (
          <View className="h-full w-full items-center justify-center bg-beige">
            <SpeciesIcon species={foster.species} color={colors.inkMuted} />
          </View>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(11,42,26,0.35)', 'rgba(11,42,26,0.94)']}
          locations={[0.25, 0.6, 1]}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0 }}
        />

        {foster.isDemo ? (
          <View className="absolute right-4 top-4">
            <DemoBadge />
          </View>
        ) : null}

        <View className="absolute bottom-0 left-0 right-0 p-5">
          <View className="mb-2 flex-row items-center">
            <View className="h-6 flex-row items-center rounded-full bg-cream/20 px-2.5">
              <SpeciesIcon species={foster.species} color={colors.cream} />
              <Text className="ml-1.5 font-extrabold text-xs uppercase tracking-[1px] text-cream">
                {foster.species === 'cat' ? 'Cat' : 'Dog'}
              </Text>
            </View>
            <Text className="ml-2.5 font-semibold text-sm text-cream/80">
              {fosterDurationLabel(fosterDuration, foster.adoptionStatus === 'Adopted')}
            </Text>
          </View>
          <Text
            className="mb-2.5 font-display text-3xl uppercase tracking-[1px] text-cream"
            numberOfLines={1}>
            {foster.name}
          </Text>
          <StatusBadge status={foster.adoptionStatus} size="sm" />
          {recentActivity ? (
            <Text
              testID={`active-foster-latest-activity-${foster.id}`}
              numberOfLines={1}
              className="mt-2 font-sans text-xs text-cream/75">
              Latest activity · {recentActivity.title}
            </Text>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
}

/** Compact row card used in the Fosters list. */
export function FosterListCard({
  foster,
  onPress,
}: {
  foster: Foster;
  onPress?: () => void;
}) {
  const fosterDuration = useFosterDuration(foster);
  const recentActivity = useRecentFosterActivity(foster);
  const mediaItems = useAppStore((state) => state.mediaItems);
  const coachGoals = useAppStore((state) => state.coachGoals);
  const contentPosts = useAppStore((state) => state.contentPosts);
  const publicationRecords = useAppStore((state) => state.publicationRecords);
  const marketingActivities = useAppStore((state) => state.marketingActivities);
  const score = calculateFosterFamousScore({ foster, mediaItems, coachGoals, contentPosts, publicationRecords, marketingActivities });

  return (
    <PressableScale
      testID={`foster-card-${foster.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${foster.name}, ${placementStatusLabel(foster.adoptionStatus)}`}
      onPress={onPress}
      scaleTo={0.98}
      style={softShadow}
      className="mb-3.5 flex-row rounded-4xl border border-hairline/60 bg-white p-3.5">
      <View className="h-[88px] w-[88px] overflow-hidden rounded-3xl bg-beige">
        {foster.photoUri ? (
          <Image
            source={{ uri: foster.photoUri }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <SpeciesIcon species={foster.species} color={colors.inkMuted} />
          </View>
        )}
      </View>
      <View className="ml-3.5 flex-1 justify-center">
        <View className="mb-1 flex-row items-center">
          <Text className="mr-2 font-display text-xl text-forest" numberOfLines={1}>
            {foster.name}
          </Text>
          {foster.isDemo ? <DemoBadge size="sm" /> : null}
        </View>
        <View className="mb-2 flex-row items-center">
          <SpeciesIcon species={foster.species} color={colors.inkMuted} />
          <Text className="ml-1.5 font-semibold text-sm text-ink-muted">
            {foster.species === 'cat' ? 'Cat' : 'Dog'} · {fosterDurationLabel(fosterDuration, foster.adoptionStatus === 'Adopted')}
          </Text>
        </View>
        <View className="mb-1.5 self-start">
          <StatusBadge status={foster.adoptionStatus} size="sm" />
        </View>
        {recentActivity ? (
          <Text
            testID={`foster-card-latest-activity-${foster.id}`}
            numberOfLines={1}
            className="mb-2 font-sans text-xs text-ink-muted">
            Latest activity · {recentActivity.title} · {formatActivityDate(recentActivity.occurredAt)}
          </Text>
        ) : null}
        <View className="flex-row items-center">
          <ProgressBar value={score.overall} height={6} className="flex-1" />
          <Text className="ml-2.5 font-extrabold text-sm text-forest">
            {score.overall}/100
          </Text>
        </View>
      </View>
    </PressableScale>
  );
}
