import { useRouter } from 'expo-router';
import {
  CalendarHeart,
  Clock4,
  FileText,
  Heart,
  Instagram,
  Laugh,
  List,
  MapPin,
  MessageCircle,
  PawPrint,
  Share2,
  Sparkles,
  ThumbsUp,
  TrendingUp,
  Video,
} from 'lucide-react-native';
import React, { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PressableScale } from '@/components/ui/Pressables';
import { Screen, SectionHeader } from '@/components/ui/Screen';
import { CREATE_OPTIONS } from '@/lib/options';
import { useActiveFosters, useAppStore } from '@/lib/state/app-store';
import { colors, softShadow } from '@/lib/theme';

const ICONS: Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  sparkles: Sparkles,
  facebook: ThumbsUp,
  instagram: Instagram,
  video: Video,
  circle: MessageCircle,
  file: FileText,
  list: List,
  map: MapPin,
  calendar: CalendarHeart,
  share: Share2,
  trending: TrendingUp,
  laugh: Laugh,
  heart: Heart,
  clock: Clock4,
  paw: PawPrint,
};

export default function CreateScreen() {
  const router = useRouter();
  const activeFosters = useActiveFosters();
  const activeFosterId = useAppStore((state) => state.activeFosterId);
  const contentPosts = useAppStore((state) => state.contentPosts);
  const activeFoster = activeFosters.find((foster) => foster.id === activeFosterId) ?? activeFosters[0];
  const draftCount = useMemo(
    () => contentPosts.filter((post) => post.status === 'Draft').length,
    [contentPosts]
  );
  const readyCount = useMemo(
    () => contentPosts.filter((post) => post.status === 'Ready to Post').length,
    [contentPosts]
  );

  if (!activeFoster) {
    return (
      <Screen testID="create-no-active-foster-screen">
        <View className="flex-1 justify-center px-5">
          <EmptyState
            testID="create-no-active-foster"
            icon={<PawPrint size={28} color={colors.forest} strokeWidth={2.2} />}
            title="Your active foster workspace is clear."
            body="Your adopted pets and their saved content are safely available in Adopted / Archived. Reactivate a foster if they return, or add a new foster to create fresh marketing content."
            actionLabel="View Adopted / Archived"
            onAction={() => router.push('/(tabs)/fosters')}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen testID="create-screen">
      <View className="px-5 pb-4 pt-2">
        <Text className="font-display text-3xl leading-[40px] text-forest">Create</Text>
        <Text className="mt-1.5 font-sans text-lg text-ink-soft">
          Make something accurate and useful for {activeFoster.name}.
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View className="mb-8 gap-3">
          <PressableScale
            testID="create-new-content"
            accessibilityRole="button"
            accessibilityLabel="Create new content"
            onPress={() => router.push({ pathname: '/create/editor', params: { kind: 'Social Media Post', fosterId: activeFoster.id } })}
            scaleTo={0.98}
            style={softShadow}
            className="flex-row items-center rounded-4xl bg-forest p-5">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-cream/15">
              <Sparkles size={22} color={colors.cream} strokeWidth={2.3} />
            </View>
            <View className="ml-4 flex-1">
              <Text className="font-display text-2xl text-cream">Create New</Text>
              <Text className="mt-0.5 font-sans text-sm text-cream/75">Start a fresh post, bio, script, or idea.</Text>
            </View>
          </PressableScale>

          <PressableScale
            testID="create-open-drafts"
            accessibilityRole="button"
            accessibilityLabel="Open drafts and saved content"
            onPress={() => router.push('/create/saved')}
            scaleTo={0.98}
            className="flex-row items-center rounded-4xl border border-hairline bg-white p-5">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-forest-soft">
              <FileText size={21} color={colors.forest} strokeWidth={2.3} />
            </View>
            <View className="ml-4 flex-1">
              <Text className="font-display text-2xl text-forest">Drafts / Saved Content</Text>
              <Text className="mt-0.5 font-sans text-sm text-ink-muted">
                {draftCount === 0 ? 'Find and continue every saved draft.' : `${draftCount} draft${draftCount === 1 ? '' : 's'} waiting for you.`}
              </Text>
            </View>
          </PressableScale>

          <PressableScale
            testID="create-open-ready"
            accessibilityRole="button"
            accessibilityLabel="Open ready to post content"
            onPress={() => router.push({ pathname: '/create/saved', params: { status: 'ready' } })}
            scaleTo={0.98}
            className="flex-row items-center rounded-4xl border border-clay/30 bg-clay-soft p-5">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-clay">
              <Share2 size={21} color={colors.cream} strokeWidth={2.3} />
            </View>
            <View className="ml-4 flex-1">
              <Text className="font-display text-2xl text-forest">Ready to Post</Text>
              <Text className="mt-0.5 font-sans text-sm text-ink-muted">
                {readyCount === 0 ? 'Review posts you mark ready before sharing.' : `${readyCount} post${readyCount === 1 ? '' : 's'} ready when you are.`}
              </Text>
            </View>
          </PressableScale>
        </View>

        <SectionHeader title="Create New" />
        {CREATE_OPTIONS.map((option, index) => {
          const Icon = ICONS[option.icon] ?? Sparkles;
          const featured = index === 0;
          return (
            <Animated.View key={option.title} entering={FadeInDown.delay(35 * index).duration(400)}>
              <PressableScale
                testID={`create-option-${index}`}
                accessibilityRole="button"
                accessibilityLabel={option.title}
                onPress={() => router.push({ pathname: '/create/editor', params: { kind: option.title, fosterId: activeFoster.id } })}
                scaleTo={0.98}
                style={softShadow}
                className={featured ? 'mb-3 flex-row items-center rounded-4xl bg-forest p-4' : 'mb-3 flex-row items-center rounded-4xl border border-hairline/60 bg-white p-4'}>
                <View className={featured ? 'h-12 w-12 items-center justify-center rounded-2xl bg-cream/20' : 'h-12 w-12 items-center justify-center rounded-2xl bg-clay-soft'}>
                  <Icon size={21} color={featured ? colors.cream : colors.clayDeep} strokeWidth={2.2} />
                </View>
                <View className="ml-4 flex-1">
                  <Text className={featured ? 'font-bold text-lg text-cream' : 'font-bold text-lg text-ink'}>{option.title}</Text>
                  <Text className={featured ? 'mt-0.5 font-sans text-base text-cream/75' : 'mt-0.5 font-sans text-base text-ink-muted'}>{option.blurb}</Text>
                </View>
              </PressableScale>
            </Animated.View>
          );
        })}

        <Card tone="beige" className="mt-3" raised={false}>
          <Text className="font-bold text-base text-forest">Saved automatically, easy to recover</Text>
          <Text className="mt-1 font-sans text-sm leading-[20px] text-ink-soft">
            Drafts remain in Drafts / Saved Content after you leave the editor or reopen the app.
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}
