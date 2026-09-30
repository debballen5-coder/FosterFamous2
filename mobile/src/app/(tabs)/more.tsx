import { useRouter } from "expo-router";
import {
  BookOpen,
  Camera,
  FileText,
  HardDrive,
  HeartHandshake,
  HelpCircle,
  Images,
  Info,
  LineChart,
  Lock,
  Mail,
  PawPrint,
  ScrollText,
  Settings2,
  Video,
} from "lucide-react-native";
import React, { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Card } from "@/components/ui/Card";
import { ListGroup, ListRow } from "@/components/ui/ListRow";
import { PressableScale } from "@/components/ui/Pressables";
import { Screen, SectionHeader } from "@/components/ui/Screen";
import { resourceSlugForTitle } from "@/lib/info-content";
import { approximateMediaStorageBytes } from "@/lib/media-storage";
import { RESOURCE_LIBRARY, SETTINGS_ITEMS } from "@/lib/options";
import {
  getMediaForFoster,
  useActiveFoster,
  useAppStore,
} from "@/lib/state/app-store";
import { colors } from "@/lib/theme";

const SETTINGS_ICONS: Record<
  string,
  React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
> = {
  "Foster Preferences": PawPrint,
  "Rescue Information": HeartHandshake,
  "Help & FAQ": HelpCircle,
  "Privacy Policy": Lock,
  "Terms of Use": ScrollText,
  "Contact Support": Mail,
  "About Foster Famous": Info,
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function formatStorage(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default function MoreScreen() {
  const router = useRouter();
  const activeFoster = useActiveFoster();
  const mediaItems = useAppStore((state) => state.mediaItems);
  const fosterMedia = useMemo(
    () => getMediaForFoster(mediaItems, activeFoster.id),
    [activeFoster.id, mediaItems],
  );
  const photoCount = useMemo(
    () => fosterMedia.filter((item) => item.type === "photo").length,
    [fosterMedia],
  );
  const videoCount = fosterMedia.length - photoCount;
  const storageUsed = formatStorage(
    approximateMediaStorageBytes(mediaItems, activeFoster.id),
  );
  const isAdopted = activeFoster.adoptionStatus === "Adopted";

  const openInfo = (title: string) => {
    const aliases: Record<string, string> = {
      'Help & FAQ': 'help',
      'Privacy Policy': 'privacy',
      'Terms of Use': 'terms',
    };
    router.push({
      pathname: "/info/[slug]",
      params: { slug: aliases[title] ?? resourceSlugForTitle(title) },
    });
  };

  const reviewMedia = () =>
    router.push({
      pathname: "/foster/[id]",
      params: { id: activeFoster.id, section: "Media" },
    });

  return (
    <Screen testID="more-screen">
      <View className="px-5 pb-4 pt-2">
        <Text className="font-display text-3xl text-forest">More</Text>
        <Text className="mt-0.5 font-sans text-base text-ink-muted">
          Tools, guides, and settings
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Media storage */}
        <Animated.View entering={FadeInDown.duration(420)}>
          <SectionHeader title="Your Media" />
          <Card
            testID="more-media-storage-summary"
            className="overflow-hidden p-0"
          >
            <View className="bg-forest px-5 pb-5 pt-5">
              <View className="flex-row items-center">
                <View className="h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
                  <HardDrive size={22} color={colors.cream} strokeWidth={2.2} />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="font-bold text-xl text-cream">
                    Media Storage
                  </Text>
                  <Text className="mt-0.5 font-sans text-sm text-cream/75">
                    {activeFoster.name}&apos;s photo and video library
                  </Text>
                </View>
              </View>

              <Text className="mt-4 font-sans text-base leading-[21px] text-cream/90">
                {isAdopted
                  ? `${activeFoster.name} has been adopted, and their media is retained here so you can revisit their foster story.`
                  : `Keep track of the media helping ${activeFoster.name} get noticed.`}
              </Text>
            </View>

            <View className="px-5 pb-5 pt-4">
              <View className="mb-5 flex-row rounded-3xl bg-beige px-2 py-4">
                <View
                  testID="more-photo-count"
                  className="flex-1 items-center border-r border-hairline"
                >
                  <Images size={18} color={colors.forest} strokeWidth={2.2} />
                  <Text className="mt-1 font-bold text-xl text-forest">
                    {photoCount}
                  </Text>
                  <Text className="font-sans text-xs text-ink-muted">
                    Photos
                  </Text>
                </View>
                <View
                  testID="more-video-count"
                  className="flex-1 items-center border-r border-hairline"
                >
                  <Video size={18} color={colors.forest} strokeWidth={2.2} />
                  <Text className="mt-1 font-bold text-xl text-forest">
                    {videoCount}
                  </Text>
                  <Text className="font-sans text-xs text-ink-muted">
                    Videos
                  </Text>
                </View>
                <View
                  testID="more-storage-used"
                  className="flex-1 items-center"
                >
                  <HardDrive
                    size={18}
                    color={colors.forest}
                    strokeWidth={2.2}
                  />
                  <Text className="mt-1 font-bold text-xl text-forest">
                    {storageUsed}
                  </Text>
                  <Text className="font-sans text-xs text-ink-muted">
                    Approx.
                  </Text>
                </View>
              </View>

              <PressableScale
                testID="more-review-media-button"
                accessibilityRole="button"
                accessibilityLabel={`Review ${activeFoster.name}'s media`}
                onPress={reviewMedia}
                className="min-h-12 items-center justify-center rounded-2xl bg-clay px-5 py-3"
              >
                <Text className="font-bold text-base text-white">
                  Review Media
                </Text>
              </PressableScale>
            </View>
          </Card>
        </Animated.View>

        {/* Promotion tools pause after adoption, while profile history stays available. */}
        <Animated.View
          entering={FadeInDown.delay(80).duration(420)}
          className="mt-8"
        >
          <SectionHeader title={isAdopted ? "Archived foster" : "Promotion Tools"} />
          {isAdopted ? (
            <Card testID="more-adopted-foster-tools" tone="beige" raised={false}>
              <Text className="font-display text-xl text-forest">Marketing is paused</Text>
              <Text className="mt-1 font-sans text-sm leading-[20px] text-ink-soft">
                {activeFoster.name}'s photos, videos, posts, and tracker history remain safe in their adopted profile. Reactivate them if they return to foster care.
              </Text>
              <PressableScale
                testID="more-view-adopted-profile"
                accessibilityRole="button"
                onPress={() => router.push({ pathname: "/foster/[id]", params: { id: activeFoster.id } })}
                className="mt-4 self-start"
              >
                <Text className="font-bold text-sm text-forest underline">View Adopted Profile</Text>
              </PressableScale>
            </Card>
          ) : (
            <ListGroup>
              <ListRow
                testID="more-photo-coach"
                title="Photo Coach"
                subtitle="20 essential foster photos, one checklist"
                icon={
                  <Camera size={19} color={colors.forest} strokeWidth={2.2} />
                }
                onPress={() => router.push("/tools/photo-coach")}
              />
              <ListRow
                testID="more-video-coach"
                title="Video Coach"
                subtitle="Clips that get watched to the end"
                icon={<Video size={19} color={colors.forest} strokeWidth={2.2} />}
                onPress={() => router.push("/tools/video-coach")}
              />
              <ListRow
                testID="more-marketing-tracker"
                title="Marketing Activity"
                subtitle="See what’s actually working"
                icon={
                  <LineChart size={19} color={colors.forest} strokeWidth={2.2} />
                }
                onPress={() => router.push("/tools/marketing-tracker")}
              />
              <ListRow
                testID="more-hard-to-place"
                title="Hard-to-Place Pet Help"
                subtitle="When interest has stalled"
                icon={
                  <HeartHandshake
                    size={19}
                    color={colors.forest}
                    strokeWidth={2.2}
                  />
                }
                onPress={() => router.push("/tools/hard-to-place")}
                isLast
              />
            </ListGroup>
          )}
        </Animated.View>

        {/* Resource Library */}
        <Animated.View
          entering={FadeInDown.delay(160).duration(420)}
          className="mt-8"
        >
          <SectionHeader title="Resource Library" />
          <ListGroup>
            {RESOURCE_LIBRARY.map((item, i) => (
              <ListRow
                key={item.title}
                testID={`resource-${slugify(item.title)}`}
                title={item.title}
                subtitle={item.blurb}
                icon={
                  <BookOpen size={19} color={colors.forest} strokeWidth={2.2} />
                }
                onPress={() => openInfo(item.title)}
                isLast={i === RESOURCE_LIBRARY.length - 1}
              />
            ))}
          </ListGroup>
        </Animated.View>

        {/* Settings */}
        <Animated.View
          entering={FadeInDown.delay(240).duration(420)}
          className="mt-8"
        >
          <SectionHeader title="Settings" />
          <ListGroup>
            {SETTINGS_ITEMS.map((item, i) => {
              const Icon = SETTINGS_ICONS[item.title] ?? Settings2;
              return (
                <ListRow
                  key={item.title}
                  testID={`setting-${slugify(item.title)}`}
                  title={item.title}
                  subtitle={item.blurb}
                  icon={
                    <Icon size={19} color={colors.forest} strokeWidth={2.2} />
                  }
                  onPress={() => openInfo(item.title)}
                  isLast={i === SETTINGS_ITEMS.length - 1}
                />
              );
            })}
          </ListGroup>
        </Animated.View>

        {/* Accuracy promise */}
        <Animated.View
          entering={FadeInDown.delay(320).duration(420)}
          className="mt-8 rounded-4xl bg-beige p-5"
        >
          <View className="mb-2 flex-row items-center">
            <FileText size={17} color={colors.forest} strokeWidth={2.4} />
            <Text className="ml-2 font-bold text-lg text-forest">
              Our accuracy promise
            </Text>
          </View>
          <Text className="font-sans text-base leading-[21px] text-ink-soft">
            Foster Famous never invents temperament, medical history, or
            behavior. If a value is unknown, it stays unknown. We never publish
            your home address, and we never promise an animal to an adopter —
            placement is always the rescue’s call.
          </Text>
        </Animated.View>

      </ScrollView>
    </Screen>
  );
}
