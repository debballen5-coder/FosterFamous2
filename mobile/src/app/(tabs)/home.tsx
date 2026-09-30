import { useRouter } from "expo-router";
import {
  Camera,
  Check,
  ChevronRight,
  FileText,
  HeartHandshake,
  PawPrint,
  Share2,
  Sparkles,
  TrendingUp,
} from "lucide-react-native";
import React, { useMemo } from "react";
import { Dimensions, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { DemoNotice } from "@/components/DemoBadge";
import { ActiveFosterCard } from "@/components/FosterCard";
import { PawPattern } from "@/components/PawPattern";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { PressableScale } from "@/components/ui/Pressables";
import { ProgressBar, ProgressRow } from "@/components/ui/Progress";
import { Screen, SectionHeader } from "@/components/ui/Screen";
import { PHOTO_COACH_GOALS } from "@/lib/options";
import { calculateFosterFamousScore } from "@/lib/foster-score";
import { createFosterPlan, orderedPlanTasks } from "@/lib/foster-plan";
import {
  getCoachGoalsForFoster,
  isCoachGoalRecordComplete,
  useActiveFosters,
  useAppStore,
} from "@/lib/state/app-store";
import { colors, softShadow } from "@/lib/theme";
import { AdoptionBoostCard } from "@/components/AdoptionBoostCard";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 40;

const QUICK_ACTIONS = [
  {
    label: "Create a Post",
    Icon: Sparkles,
    tone: "forest" as const,
    route: "create" as const,
  },
  {
    label: "Take Better Photos",
    Icon: Camera,
    tone: "clay" as const,
    route: "photo" as const,
  },
  {
    label: "Update Adoption Bio",
    Icon: FileText,
    tone: "beige" as const,
    route: "bio" as const,
  },
  {
    label: "No Interest? Help Me",
    Icon: HeartHandshake,
    tone: "beige" as const,
    route: "help" as const,
  },
];

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning!";
  if (hour < 17) return "Good afternoon!";
  return "Good evening!";
}

export default function HomeScreen() {
  const router = useRouter();
  const fosters = useActiveFosters();
  const activeFosterId = useAppStore((s) => s.activeFosterId);
  const activeFoster = fosters.find((foster) => foster.id === activeFosterId) ?? fosters[0];
  const setActiveFoster = useAppStore((s) => s.setActiveFoster);
  const coachGoals = useAppStore((s) => s.coachGoals);
  const contentPosts = useAppStore((s) => s.contentPosts);
  const publicationRecords = useAppStore((s) => s.publicationRecords);
  const marketingActivities = useAppStore((s) => s.marketingActivities);
  const mediaItems = useAppStore((s) => s.mediaItems);
  const fosterPlans = useAppStore((s) => s.fosterPlans);
  const fosterPhotoRecords = getCoachGoalsForFoster(
    coachGoals,
    activeFoster?.id,
    "photo",
  );
  const nextPhotoGoal = PHOTO_COACH_GOALS.find(
    (goal) =>
      !isCoachGoalRecordComplete(
        fosterPhotoRecords.find((record) => record.goalId === goal.id),
      ),
  );
  const completedPhotoGoals = PHOTO_COACH_GOALS.filter((goal) =>
    isCoachGoalRecordComplete(
      fosterPhotoRecords.find((record) => record.goalId === goal.id),
    ),
  ).length;

  const showingSamples = activeFoster?.isDemo ?? false;
  const sharedToday = useMemo(() => {
    const today = new Date().toDateString();
    return publicationRecords.some(
      (record) => record.petId === activeFoster?.id && new Date(record.postedAt).toDateString() === today
    );
  }, [activeFoster?.id, publicationRecords]);
  const activePlan = activeFoster?.isDemo ? createFosterPlan() : fosterPlans[activeFoster?.id ?? ''];
  const nextPlanTask = orderedPlanTasks(activePlan).find((task) => task.status === 'todo');
  const readyPlanPost = useMemo(() => {
    return nextPlanTask
      ? contentPosts.find((post) => post.petId === activeFoster?.id && post.planDay === nextPlanTask.day && post.status === 'Ready to Post')
      : undefined;
  }, [activeFoster?.id, contentPosts, nextPlanTask]);
  const liveScore = activeFoster ? calculateFosterFamousScore({
    foster: activeFoster,
    mediaItems,
    coachGoals,
    contentPosts,
    publicationRecords,
    marketingActivities,
  }) : null;

  if (!activeFoster) {
    return (
      <Screen testID="home-no-active-fosters-screen">
        <PawPattern color={colors.forest} height={260} />
        <View className="flex-1 justify-center px-5">
          <EmptyState
            testID="home-no-active-fosters"
            icon={<PawPrint size={28} color={colors.forest} strokeWidth={2.2} />}
            title="No active fosters right now."
            body="Your adopted foster profiles and all of their history are safe in Adopted / Archived. Add a foster or reactivate one if they return."
            actionLabel="Add a Foster"
            onAction={() => router.push('/foster/wizard')}
            secondaryActionLabel="View Adopted Fosters"
            onSecondaryAction={() => router.push('/(tabs)/fosters')}
          />
        </View>
      </Screen>
    );
  }

  const goQuickAction = (route: "create" | "photo" | "bio" | "help") => {
    if (route === "create") {
      router.push({
        pathname: "/create/editor",
        params: { kind: "Social Media Post", fosterId: activeFoster.id },
      });
    } else if (route === "photo") {
      router.push({
        pathname: "/tools/photo-coach",
        params: { fosterId: activeFoster.id, goalId: nextPhotoGoal?.id },
      });
    } else if (route === "bio") {
      router.push({
        pathname: "/create/editor",
        params: { kind: "Adoption Bio", fosterId: activeFoster.id },
      });
    } else {
      router.push("/tools/hard-to-place");
    }
  };

  return (
    <Screen testID="home-screen">
      <PawPattern color={colors.forest} height={300} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <Animated.View
          entering={FadeInDown.duration(450)}
          className="px-5 pb-5 pt-2"
        >
          <Text className="font-display text-3xl text-forest">
            {greeting()} 🐾
          </Text>
          <Text className="mt-1 font-sans text-lg text-ink-soft">
            Who are we making famous today?
          </Text>
        </Animated.View>

        {showingSamples ? (
          <View className="mb-4 px-5">
            <DemoNotice text="You’re looking at sample pets so you can explore. Add your own foster and these disappear." />
          </View>
        ) : null}

        {sharedToday && !showingSamples ? (
          <Animated.View entering={FadeInDown.delay(45).duration(400)} className="mb-4 px-5">
            <View testID="home-shared-today" className="flex-row items-center rounded-3xl bg-forest-soft px-4 py-3">
              <View className="h-10 w-10 items-center justify-center rounded-2xl bg-forest"><Check size={20} color={colors.cream} strokeWidth={3} /></View>
              <View className="ml-3 flex-1"><Text className="font-bold text-base text-forest">Nice work! 🐾</Text><Text className="mt-0.5 font-sans text-sm text-ink-soft">{activeFoster.name} was shared today.</Text></View>
            </View>
          </Animated.View>
        ) : null}

        {/* Active foster — horizontally swipeable once there are several */}
        <Animated.View entering={FadeInDown.delay(80).duration(450)}>
          {fosters.length > 1 ? (
            <ScrollView
              horizontal
              pagingEnabled
              decelerationRate="fast"
              snapToInterval={CARD_WIDTH + 12}
              snapToAlignment="start"
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0 }}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
            >
              {fosters.map((foster) => (
                <ActiveFosterCard
                  key={foster.id}
                  foster={foster}
                  width={CARD_WIDTH}
                  onPress={() => {
                    setActiveFoster(foster.id);
                    router.push(`/foster/${foster.id}`);
                  }}
                />
              ))}
            </ScrollView>
          ) : (
            <View className="px-5">
              <ActiveFosterCard
                foster={activeFoster}
                onPress={() => router.push(`/foster/${activeFoster.id}`)}
              />
            </View>
          )}
          {fosters.length > 1 ? (
            <Text className="mt-2.5 px-5 font-sans text-sm text-ink-muted">
              Swipe to see your other fosters
            </Text>
          ) : null}
        </Animated.View>

        {readyPlanPost ? (
          <Animated.View entering={FadeInDown.delay(130).duration(450)} className="mt-5 px-5">
            <PressableScale testID="home-ready-to-post" accessibilityRole="button" accessibilityLabel="Share your ready post" onPress={() => router.push({ pathname: '/share/[postId]', params: { postId: readyPlanPost.id } })} scaleTo={0.98} className="flex-row items-center rounded-4xl border border-clay/30 bg-clay-soft p-4" style={softShadow}>
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-clay"><Share2 size={20} color={colors.white} strokeWidth={2.4} /></View>
              <View className="ml-3 flex-1"><Text className="font-bold text-lg text-ink">Ready to post today</Text><Text className="mt-0.5 font-sans text-sm text-ink-soft" numberOfLines={1}>{readyPlanPost.hook || readyPlanPost.caption}</Text></View>
              <Text className="font-bold text-sm text-clay-deep">Share Now</Text>
            </PressableScale>
          </Animated.View>
        ) : null}

        {/* Adoption Boost — one deterministic, foster-specific next step. */}
        <Animated.View entering={FadeInDown.delay(160).duration(450)} className="mt-7 px-5">
          <AdoptionBoostCard foster={activeFoster} />
          {!activeFoster.isDemo ? (
            <PressableScale
              testID="home-whats-new"
              accessibilityRole="button"
              accessibilityLabel={`What's new with ${activeFoster.name}`}
              onPress={() => router.push({ pathname: '/foster/update', params: { fosterId: activeFoster.id } })}
              className="mt-3 flex-row items-center justify-between rounded-3xl border border-hairline bg-white px-4 py-3">
              <View className="flex-1 pr-3">
                <Text className="font-bold text-base text-forest">What’s New With {activeFoster.name}?</Text>
                <Text className="mt-0.5 font-sans text-sm text-ink-muted">Save a current status or milestone before your next post.</Text>
              </View>
              <ChevronRight size={20} color={colors.forest} strokeWidth={2.4} />
            </PressableScale>
          ) : null}
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(210).duration(450)}
          className="mt-5 px-5"
        >
          <PressableScale
            testID="next-photo-goal-card"
            accessibilityRole="button"
            accessibilityLabel={
              nextPhotoGoal
                ? `Next photo goal: ${nextPhotoGoal.label}`
                : "Review completed photo goals"
            }
            onPress={() =>
              router.push({
                pathname: "/tools/photo-coach",
                params: {
                  fosterId: activeFoster.id,
                  goalId: nextPhotoGoal?.id,
                },
              })
            }
            scaleTo={0.98}
            className="overflow-hidden rounded-4xl border border-hairline/60 bg-white p-5"
            style={softShadow}
          >
            <View className="flex-row items-center">
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-clay-soft">
                <Camera size={22} color={colors.clayDeep} strokeWidth={2.3} />
              </View>
              <View className="ml-4 flex-1">
                <Text className="font-extrabold text-xs uppercase tracking-[1.2px] text-clay-deep">
                  Next Photo Goal
                </Text>
                <Text className="mt-0.5 font-display text-xl text-forest">
                  {nextPhotoGoal?.label ?? "Photo checklist complete"}
                </Text>
                <Text className="mt-1 font-sans text-sm text-ink-muted">
                  {completedPhotoGoals} of {PHOTO_COACH_GOALS.length} captured
                </Text>
              </View>
              <ChevronRight size={21} color={colors.forest} strokeWidth={2.4} />
            </View>
            <ProgressBar
              value={(completedPhotoGoals / PHOTO_COACH_GOALS.length) * 100}
              height={7}
              tone="clay"
              className="mt-4"
            />
          </PressableScale>
        </Animated.View>

        {/* Quick actions */}
        <Animated.View
          entering={FadeInDown.delay(240).duration(450)}
          className="mt-8 px-5"
        >
          <SectionHeader title="Quick actions" />
          <View className="flex-row flex-wrap gap-3">
            {QUICK_ACTIONS.map(({ label, Icon, tone, route }) => {
              const isForest = tone === "forest";
              const isClay = tone === "clay";
              return (
                <PressableScale
                  key={label}
                  testID={`quick-action-${route}`}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  onPress={() => goQuickAction(route)}
                  scaleTo={0.96}
                  style={[{ width: "48%" }, softShadow]}
                  className={
                    isForest
                      ? "h-[124px] justify-between rounded-4xl bg-forest-mid p-4"
                      : isClay
                        ? "h-[124px] justify-between rounded-4xl bg-clay p-4"
                        : "h-[124px] justify-between rounded-4xl border border-hairline/60 bg-white p-4"
                  }
                >
                  <View
                    className={
                      isForest || isClay
                        ? "h-10 w-10 items-center justify-center rounded-2xl bg-white/20"
                        : "h-10 w-10 items-center justify-center rounded-2xl bg-forest-soft"
                    }
                  >
                    <Icon
                      size={20}
                      color={isForest || isClay ? colors.white : colors.forest}
                      strokeWidth={2.2}
                    />
                  </View>
                  <Text
                    className={
                      isForest || isClay
                        ? "font-bold text-lg leading-[22px] text-white"
                        : "font-bold text-lg leading-[22px] text-ink"
                    }
                  >
                    {label}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
        </Animated.View>

        {/* Foster Famous Score */}
        <Animated.View
          entering={FadeInDown.delay(320).duration(450)}
          className="mt-8 px-5"
        >
          <SectionHeader title="Foster Famous Score" />
          <Card tone="white" className="p-6">
            <View className="mb-5 flex-row items-center justify-between">
              <View className="flex-1 pr-4">
                <Text className="font-bold text-lg text-ink">
                  {activeFoster.name}’s Foster Famous Score
                </Text>
                <Text className="mt-1 font-sans text-base text-ink-muted">
                  How ready this campaign is
                </Text>
              </View>
              <View className="h-[74px] w-[74px] items-center justify-center rounded-full border-[6px] border-forest-soft">
                <Text className="font-display text-2xl text-forest">
                  {liveScore?.overall ?? 0}/100
                </Text>
              </View>
            </View>

            <ProgressBar value={liveScore?.overall ?? 0} height={10} className="mb-4" />
            {liveScore?.categories.map((category, index) => (
              <View key={category.key} className={index === liveScore.categories.length - 1 ? undefined : "mb-3.5"}>
                <ProgressRow label={`${category.label} · ${category.earned}/${category.possible}`} value={(category.earned / category.possible) * 100} delay={80 * index} tone={category.key === 'video' || category.key === 'activity' ? 'clay' : undefined} />
              </View>
            ))}
            <View className="mt-4 rounded-2xl bg-forest-soft p-3.5">
              <Text className="font-extrabold text-xs uppercase tracking-[1px] text-forest">Biggest opportunity</Text>
              <Text className="mt-1 font-sans text-sm leading-[20px] text-ink-soft">{liveScore?.biggestOpportunity}</Text>
            </View>

            <Button
              testID="improve-score-button"
              label="Improve My Score"
              variant="secondary"
              size="md"
              className="mt-3"
              icon={
                <TrendingUp size={17} color={colors.forest} strokeWidth={2.4} />
              }
              onPress={() => {
                if (!liveScore || activeFoster.isDemo) {
                  router.push(`/foster/${activeFoster.id}?section=Progress`);
                  return;
                }
                if (liveScore.destination === 'profile') router.push({ pathname: '/foster/wizard', params: { id: activeFoster.id } });
                else if (liveScore.destination === 'photo-coach') router.push({ pathname: '/tools/photo-coach', params: { fosterId: activeFoster.id, ...liveScore.destinationParams } });
                else if (liveScore.destination === 'video-coach') router.push({ pathname: '/tools/video-coach', params: { fosterId: activeFoster.id } });
                else if (liveScore.destination === 'adoption-bio') router.push({ pathname: '/create/editor', params: { fosterId: activeFoster.id, kind: 'Adoption Bio' } });
                else router.push({ pathname: '/create/editor', params: { fosterId: activeFoster.id, source: 'idea', ...liveScore.destinationParams } });
              }}
            />
          </Card>
        </Animated.View>

        {/* 30-day plan nudge */}
        <Animated.View
          entering={FadeInDown.delay(400).duration(450)}
          className="mt-5 px-5"
        >
          <PressableScale
            testID="home-plan-nudge"
            accessibilityRole="button"
            accessibilityLabel="Open your 30-day plan"
            onPress={() => router.push("/(tabs)/plan")}
            scaleTo={0.98}
            style={softShadow}
            className="flex-row items-center rounded-4xl bg-beige p-5"
          >
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-white">
              <PawPrint size={21} color={colors.clayDeep} strokeWidth={2.3} />
            </View>
            <View className="ml-4 flex-1">
              <Text className="font-bold text-lg text-ink">
                {nextPlanTask ? `Next: Day ${nextPlanTask.scheduledDay} of 30` : '30-Day Plan complete'}
              </Text>
              <Text className="mt-0.5 font-sans text-base text-ink-soft">
                {nextPlanTask ? 'Open your next helpful action' : 'Review your campaign progress'}
              </Text>
            </View>
            <ChevronRight size={20} color={colors.forest} strokeWidth={2.4} />
          </PressableScale>
        </Animated.View>

        {/* Quiet accuracy promise for generated and shared content */}
        <View className="mt-7 px-5">
          <Text className="text-center font-sans text-sm leading-[19px] text-ink-muted">
            Foster Famous only writes from what you record. Unknown stays
            unknown.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
