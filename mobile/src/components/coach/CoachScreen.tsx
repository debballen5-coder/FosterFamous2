import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Camera,
  Check,
  ChevronRight,
  Film,
  ImagePlus,
  Lightbulb,
  Play,
  Sparkles,
  X,
} from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { MediaThumbnail } from "@/components/MediaThumbnail";
import { Button, TinyButton } from "@/components/ui/Button";
import { PressableScale } from "@/components/ui/Pressables";
import { ProgressBar } from "@/components/ui/Progress";
import { Screen, ScreenHeader } from "@/components/ui/Screen";
import { cn } from "@/lib/cn";
import { pickMediaFromLibrary } from "@/lib/media-storage";
import { goBackOrReplace } from "@/lib/navigation";
import type { CoachGoalOption } from "@/lib/options";
import {
  getCoachGoalsForFoster,
  getMediaForFoster,
  isCoachGoalRecordComplete,
  useActiveFoster,
  useAppStore,
  useDisplayFosters,
} from "@/lib/state/app-store";
import { colors, liftedShadow, softShadow } from "@/lib/theme";
import type { CoachMediaType, MediaItem } from "@/lib/types";

const GUIDANCE: Record<CoachMediaType, { why: string; tip: string }> = {
  photo: {
    why: "Clear, varied photos help adopters picture this pet in their own life and give every post a fresh visual story.",
    tip: "Use window light, get down to eye level, and take a short burst so you can keep the most natural frame.",
  },
  video: {
    why: "A short real-life clip shows movement and personality in a way a written description cannot.",
    tip: "Hold steady, start with the action already happening, and keep the strongest moment under ten seconds.",
  },
};

function durationLabel(durationMs: number | null): string | null {
  if (durationMs === null) return null;
  const seconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(seconds / 60);
  return minutes > 0
    ? `${minutes}:${String(seconds % 60).padStart(2, "0")}`
    : `${seconds} sec`;
}

interface CoachScreenProps {
  mediaType: CoachMediaType;
  goals: readonly CoachGoalOption[];
  title: string;
  headline: string;
  intro: (fosterName: string) => string;
}

export function CoachScreen({
  mediaType,
  goals,
  title,
  headline,
  intro,
}: CoachScreenProps) {
  const router = useRouter();
  const params = useLocalSearchParams<{ fosterId?: string; goalId?: string }>();
  const activeFoster = useActiveFoster();
  const fosters = useDisplayFosters();
  const foster =
    fosters.find((candidate) => candidate.id === params.fosterId) ??
    activeFoster;

  const mediaItems = useAppStore((state) => state.mediaItems);
  const coachGoals = useAppStore((state) => state.coachGoals);
  const saveMediaAssets = useAppStore((state) => state.saveMediaAssets);
  const attachMedia = useAppStore((state) => state.attachMediaToCoachGoal);
  const detachMedia = useAppStore((state) => state.detachMediaFromCoachGoal);
  const setManualCompletion = useAppStore(
    (state) => state.setCoachGoalManualCompletion,
  );

  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<"detail" | "picker">("detail");
  const [replaceExisting, setReplaceExisting] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);

  const records = getCoachGoalsForFoster(coachGoals, foster.id, mediaType);
  const fosterMedia = getMediaForFoster(mediaItems, foster.id, {
    type: mediaType,
  });
  const recordByGoalId = useMemo(
    () => new Map(records.map((record) => [record.goalId, record])),
    [records],
  );
  const mediaById = useMemo(
    () => new Map(fosterMedia.map((media) => [media.id, media])),
    [fosterMedia],
  );
  const doneCount = goals.filter((goal) =>
    isCoachGoalRecordComplete(recordByGoalId.get(goal.id)),
  ).length;
  const selectedGoal = goals.find((goal) => goal.id === selectedGoalId);
  const selectedRecord = selectedGoal
    ? recordByGoalId.get(selectedGoal.id)
    : undefined;
  const attachedMedia = (selectedRecord?.mediaIds ?? [])
    .map((id) => mediaById.get(id))
    .filter((media): media is MediaItem => Boolean(media));

  useEffect(() => {
    if (params.goalId && goals.some((goal) => goal.id === params.goalId)) {
      setSelectedGoalId(params.goalId);
      setPanelMode("detail");
    }
  }, [goals, params.goalId]);

  const closePanel = () => {
    setSelectedGoalId(null);
    setPanelMode("detail");
    setReplaceExisting(false);
    setMessage(null);
  };

  const attachChosenMedia = (media: MediaItem) => {
    if (!selectedGoal || foster.isDemo || foster.adoptionStatus === "Adopted") return;
    if (replaceExisting) {
      attachedMedia.forEach((item) =>
        detachMedia(foster.id, mediaType, selectedGoal.id, item.id),
      );
    }
    attachMedia(foster.id, mediaType, selectedGoal.id, media.id);
    setPanelMode("detail");
    setReplaceExisting(false);
    setMessage(null);
  };

  const addMediaMutation = useMutation({
    mutationFn: async ({ goal }: { goal: CoachGoalOption; attachedIds: string[]; replace: boolean }) => {
      const picked = await pickMediaFromLibrary(
        mediaType,
        mediaType === "photo" ? 6 : 1,
      );
      if (picked.permissionDenied) return { status: "permission-denied" as const, stored: [] };
      if (picked.canceled || picked.assets.length === 0) {
        return { status: "canceled" as const, stored: [] };
      }
      const stored = await saveMediaAssets({
        fosterId: foster.id,
        type: mediaType,
        assets: picked.assets,
        source: "library",
        tags: [goal.suggestedTag],
      });
      if (stored.length === 0) throw new Error("The selected media could not be saved.");
      return { status: "saved" as const, stored };
    },
    onMutate: () => setMessage(null),
    onSuccess: (result, { goal, attachedIds, replace }) => {
      if (result.status === "permission-denied") {
        setMessage(
          "Photo library access is needed to add media. You can enable it in device settings.",
        );
        return;
      }
      if (result.status === "canceled") return;
      if (replace) {
        attachedIds.forEach((mediaId) =>
          detachMedia(foster.id, mediaType, goal.id, mediaId),
        );
      }
      result.stored.forEach((item) =>
        attachMedia(foster.id, mediaType, goal.id, item.id),
      );
      setReplaceExisting(false);
      setPanelMode("detail");
    },
    onError: () => setMessage("That media could not be saved. Please try another item."),
  });
  const { isPending: busy, mutate: addMedia } = addMediaMutation;

  const addNewMedia = () => {
    if (!selectedGoal || busy || foster.isDemo || foster.adoptionStatus === "Adopted") return;
    addMedia({
      goal: selectedGoal,
      attachedIds: attachedMedia.map((item) => item.id),
      replace: replaceExisting,
    });
  };

  const createFromMedia = (media: MediaItem) => {
    if (!selectedGoal || foster.adoptionStatus === "Adopted") return;
    router.push({
      pathname: "/create/editor",
      params: {
        kind:
          mediaType === "video" ? "Reel / TikTok Script" : "Social Media Post",
        fosterId: foster.id,
        source: mediaType,
        context: `${selectedGoal.label} for ${foster.name}. Use the attached ${mediaType} as the source for this post.`,
        mediaId: media.id,
        sourceUri: media.localUri,
      },
    });
    closePanel();
  };

  const MediaIcon = mediaType === "photo" ? Camera : Film;
  const noun = mediaType === "photo" ? "photo" : "video";

  if (foster.adoptionStatus === "Adopted") {
    return (
      <Screen testID={`${mediaType}-coach-adopted-screen`} edges={["top"]}>
        <ScreenHeader title={title} onBack={() => goBackOrReplace(router, "/(tabs)/more")} />
        <View className="flex-1 items-center justify-center px-7 pb-20">
          <Text className="text-center font-display text-2xl text-forest">{foster.name}'s marketing is archived.</Text>
          <Text className="mt-2 text-center font-sans text-base leading-[22px] text-ink-muted">
            Their {noun}s and completed goals are safely preserved, but new marketing goals are paused while they are adopted.
          </Text>
          <Button
            testID={`${mediaType}-coach-adopted-profile`}
            label="View Adopted Profile"
            className="mt-6"
            onPress={() => router.replace({ pathname: "/foster/[id]", params: { id: foster.id } })}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen testID={`${mediaType}-coach-screen`} edges={["top"]}>
      <ScreenHeader
        title={title}
        onBack={() => goBackOrReplace(router, "/(tabs)/more")}
      />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 44 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400)}>
          <Text className="font-display text-3xl leading-[40px] text-forest">
            {headline}
          </Text>
          <Text className="mt-1.5 font-sans text-lg leading-[24px] text-ink-soft">
            {intro(foster.name)}
          </Text>
        </Animated.View>

        <View
          testID={`${mediaType}-coach-progress`}
          className={cn(
            "my-5 rounded-4xl p-5",
            mediaType === "photo" ? "bg-forest" : "bg-clay",
          )}
          style={softShadow}
        >
          <View className="mb-3 flex-row items-center">
            <MediaIcon size={18} color={colors.cream} strokeWidth={2.3} />
            <Text className="ml-2 font-bold text-lg text-cream">
              {doneCount} of {goals.length} goals captured
            </Text>
          </View>
          <ProgressBar
            value={(doneCount / goals.length) * 100}
            tone="cream"
            height={9}
          />
          <Text className="mt-3 font-sans text-sm text-cream/75">
            An attachment or a manual check counts toward progress.
          </Text>
        </View>

        <View
          className="overflow-hidden rounded-4xl border border-hairline/70 bg-white"
          style={softShadow}
        >
          {goals.map((goal, index) => {
            const record = recordByGoalId.get(goal.id);
            const attached = (record?.mediaIds ?? [])
              .map((id) => mediaById.get(id))
              .find((item): item is MediaItem => Boolean(item));
            const completed = isCoachGoalRecordComplete(record);
            return (
              <PressableScale
                key={goal.id}
                testID={`${mediaType}-goal-${goal.id}`}
                accessibilityRole="button"
                accessibilityLabel={`${goal.label}, ${completed ? "Captured" : "Not Captured"}`}
                onPress={() => {
                  setSelectedGoalId(goal.id);
                  setPanelMode("detail");
                  setMessage(null);
                }}
                className={cn(
                  "min-h-[82px] flex-row items-center px-4 py-3.5",
                  index < goals.length - 1 && "border-b border-hairline/70",
                )}
              >
                {attached ? (
                  <MediaThumbnail
                    media={attached}
                    size={54}
                    testID={`${mediaType}-goal-${goal.id}-thumb`}
                  />
                ) : (
                  <View
                    className={cn(
                      "h-[54px] w-[54px] items-center justify-center rounded-2xl",
                      completed ? "bg-forest-soft" : "bg-beige",
                    )}
                  >
                    {completed ? (
                      <Check
                        size={22}
                        color={colors.forest}
                        strokeWidth={2.8}
                      />
                    ) : (
                      <MediaIcon
                        size={21}
                        color={colors.inkMuted}
                        strokeWidth={2}
                      />
                    )}
                  </View>
                )}
                <View className="ml-3.5 flex-1">
                  <Text className="font-bold text-lg text-ink">
                    {goal.label}
                  </Text>
                  <Text
                    testID={`${mediaType}-goal-${goal.id}-status`}
                    className={cn(
                      "mt-0.5 font-extrabold text-xs uppercase tracking-[1px]",
                      completed ? "text-forest" : "text-ink-muted",
                    )}
                  >
                    {completed ? "Captured" : "Not Captured"}
                    {attached && durationLabel(attached.durationMs)
                      ? ` · ${durationLabel(attached.durationMs)}`
                      : null}
                  </Text>
                </View>
                <ChevronRight
                  size={19}
                  color={colors.inkMuted}
                  strokeWidth={2.2}
                />
              </PressableScale>
            );
          })}
        </View>

        <View className="mt-5 flex-row items-start rounded-4xl bg-beige p-5">
          <Lightbulb size={18} color={colors.forest} strokeWidth={2.3} />
          <Text className="ml-2.5 flex-1 font-sans text-base leading-[21px] text-ink-soft">
            Open any goal for a quick coaching tip, then attach something
            already in {foster.name}’s library or add a new {noun}.
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={Boolean(selectedGoal)}
        transparent
        animationType="slide"
        onRequestClose={closePanel}
      >
        <View className="flex-1 justify-end bg-forest-deep/45">
          <View
            testID={`${mediaType}-coach-detail-panel`}
            className="max-h-[88%] rounded-t-[34px] bg-cream px-5 pb-8 pt-3"
            style={liftedShadow}
          >
            <View className="mb-3 flex-row items-center justify-between">
              <View className="h-1.5 w-12 rounded-full bg-beige-dark" />
              <PressableScale
                testID={`${mediaType}-coach-close-button`}
                accessibilityRole="button"
                accessibilityLabel="Close coach details"
                onPress={closePanel}
                className="h-11 w-11 items-center justify-center rounded-full bg-white"
              >
                <X size={20} color={colors.forest} />
              </PressableScale>
            </View>

            {selectedGoal ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                {panelMode === "picker" ? (
                  <View testID={`${mediaType}-existing-media-picker`}>
                    <Text className="font-display text-2xl text-forest">
                      Choose Existing{" "}
                      {mediaType === "photo" ? "Photo" : "Video"}
                    </Text>
                    <Text className="mt-1 font-sans text-base text-ink-soft">
                      Only media saved for {foster.name} appears here.
                    </Text>
                    {fosterMedia.length > 0 ? (
                      <View className="mt-5 flex-row flex-wrap gap-3">
                        {fosterMedia.map((media) => (
                          <PressableScale
                            key={media.id}
                            testID={`${mediaType}-picker-item-${media.id}`}
                            accessibilityRole="button"
                            accessibilityLabel={`Attach ${mediaType}`}
                            onPress={() => attachChosenMedia(media)}
                            className="rounded-3xl border-2 border-transparent bg-white p-2"
                          >
                            <MediaThumbnail
                              media={media}
                              size={112}
                              testID={`${mediaType}-picker-thumb-${media.id}`}
                            />
                            {durationLabel(media.durationMs) ? (
                              <Text className="mt-1.5 text-center font-bold text-sm text-ink-soft">
                                {durationLabel(media.durationMs)}
                              </Text>
                            ) : null}
                          </PressableScale>
                        ))}
                      </View>
                    ) : (
                      <View className="mt-5 items-center rounded-4xl bg-beige p-7">
                        <ImagePlus size={28} color={colors.forest} />
                        <Text className="mt-2 text-center font-bold text-lg text-ink">
                          No saved {noun}s yet
                        </Text>
                        <Text className="mt-1 text-center font-sans text-base text-ink-soft">
                          Add one from your device and it will be saved for
                          reuse.
                        </Text>
                      </View>
                    )}
                    {message ? (
                      <Text
                        testID={`${mediaType}-coach-message`}
                        className="mt-4 font-sans text-sm text-clay-deep"
                      >
                        {message}
                      </Text>
                    ) : null}
                    <Button
                      testID={`${mediaType}-picker-add-new-button`}
                      label={`Add New ${mediaType === "photo" ? "Photo" : "Video"}`}
                      onPress={() => void addNewMedia()}
                      loading={busy}
                      disabled={foster.isDemo}
                      className="mt-5"
                    />
                    <Button
                      testID={`${mediaType}-picker-back-button`}
                      label="Back to Goal"
                      variant="ghost"
                      onPress={() => setPanelMode("detail")}
                      className="mt-2"
                    />
                  </View>
                ) : (
                  <View>
                    <View className="mb-2 flex-row items-center">
                      <View className="h-10 w-10 items-center justify-center rounded-2xl bg-forest-soft">
                        <MediaIcon size={19} color={colors.forest} />
                      </View>
                      <View className="ml-3 flex-1">
                        <Text className="font-extrabold text-xs uppercase tracking-[1.2px] text-clay-deep">
                          Goal
                        </Text>
                        <Text className="font-display text-2xl text-forest">
                          {selectedGoal.label}
                        </Text>
                      </View>
                    </View>

                    <View
                      className="mt-4 rounded-4xl bg-white p-5"
                      style={softShadow}
                    >
                      <Text className="font-bold text-lg text-ink">
                        Why It Matters
                      </Text>
                      <Text className="mt-1.5 font-sans text-base leading-[22px] text-ink-soft">
                        {GUIDANCE[mediaType].why}
                      </Text>
                      <View className="my-4 h-px bg-hairline" />
                      <Text className="font-bold text-lg text-ink">
                        Quick Tip
                      </Text>
                      <Text className="mt-1.5 font-sans text-base leading-[22px] text-ink-soft">
                        {GUIDANCE[mediaType].tip}
                      </Text>
                    </View>

                    <Text className="mb-3 mt-5 font-display text-xl text-forest">
                      Attached Media
                    </Text>
                    {attachedMedia.length > 0 ? (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={{ flexGrow: 0 }}
                        contentContainerStyle={{ gap: 12 }}
                      >
                        {attachedMedia.map((media) => (
                          <View
                            key={media.id}
                            className="w-[174px] rounded-3xl bg-white p-2.5"
                          >
                            <MediaThumbnail
                              media={media}
                              size={154}
                              testID={`${mediaType}-attached-${media.id}`}
                            />
                            <Text className="mt-2 font-bold text-sm text-ink-soft">
                              {durationLabel(media.durationMs) ??
                                "Attached media"}
                            </Text>
                            <View className="mt-2 flex-row gap-2">
                              <TinyButton
                                testID={`${mediaType}-view-media-${media.id}`}
                                label="View Media"
                                onPress={() =>
                                  router.push({
                                    pathname: "/media/[id]",
                                    params: { id: media.id, fosterId: foster.id },
                                  })
                                }
                              />
                              <TinyButton
                                testID={`${mediaType}-create-from-${media.id}`}
                                label="Create"
                                tone="clay"
                                onPress={() => createFromMedia(media)}
                              />
                            </View>
                          </View>
                        ))}
                      </ScrollView>
                    ) : (
                      <View className="flex-row items-center rounded-3xl border border-dashed border-hairline bg-cream-deep p-4">
                        <ImagePlus size={21} color={colors.inkMuted} />
                        <Text className="ml-3 flex-1 font-sans text-base text-ink-muted">
                          No {noun} attached yet.
                        </Text>
                      </View>
                    )}

                    {foster.isDemo ? (
                      <View
                        testID={`${mediaType}-coach-demo-notice`}
                        className="mt-4 rounded-3xl bg-clay-soft p-4"
                      >
                        <Text className="font-bold text-base text-clay-deep">
                          Sample foster preview
                        </Text>
                        <Text className="mt-1 font-sans text-sm leading-[19px] text-ink-soft">
                          Add your own foster to save media and track captured
                          goals.
                        </Text>
                      </View>
                    ) : null}
                    {message ? (
                      <Text
                        testID={`${mediaType}-coach-message`}
                        className="mt-4 font-sans text-sm text-clay-deep"
                      >
                        {message}
                      </Text>
                    ) : null}

                    <View className="mt-5 gap-2.5">
                      <Button
                        testID={`${mediaType}-choose-existing-button`}
                        label={
                          attachedMedia.length > 0
                            ? `Replace ${mediaType === "photo" ? "Photo" : "Video"}`
                            : `Attach ${mediaType === "photo" ? "Photo" : "Video"}`
                        }
                        variant="secondary"
                        disabled={foster.isDemo}
                        icon={<Play size={17} color={colors.forest} />}
                        onPress={() => {
                          setReplaceExisting(attachedMedia.length > 0);
                          setPanelMode("picker");
                        }}
                      />
                      <Button
                        testID={`${mediaType}-add-new-button`}
                        label={`Add New ${mediaType === "photo" ? "Photo" : "Video"}`}
                        onPress={() => void addNewMedia()}
                        loading={busy}
                        disabled={foster.isDemo}
                        icon={<ImagePlus size={18} color={colors.cream} />}
                      />
                      <Button
                        testID={`${mediaType}-manual-completion-button`}
                        label={
                          selectedRecord?.manuallyCompleted
                            ? "Mark Not Captured"
                            : "Mark Captured"
                        }
                        variant="outline"
                        disabled={foster.isDemo}
                        icon={
                          selectedRecord?.manuallyCompleted ? null : (
                            <Check size={18} color={colors.forest} />
                          )
                        }
                        onPress={() =>
                          setManualCompletion(
                            foster.id,
                            mediaType,
                            selectedGoal.id,
                            !(selectedRecord?.manuallyCompleted ?? false),
                          )
                        }
                      />
                    </View>

                    {attachedMedia.length > 0 ? (
                      <View className="mt-4 flex-row items-center rounded-3xl bg-forest-soft p-4">
                        <Sparkles size={18} color={colors.forest} />
                        <Text className="ml-2.5 flex-1 font-sans text-sm leading-[19px] text-forest">
                          This media stays in {foster.name}’s library and can be
                          attached to other goals too.
                        </Text>
                      </View>
                    ) : null}
                  </View>
                )}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
