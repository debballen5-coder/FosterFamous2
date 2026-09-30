import { useMutation } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Camera,
  Cat,
  ChevronLeft,
  Dog,
  MapPin,
  PawPrint,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
} from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { AdoptionBoostCard } from '@/components/AdoptionBoostCard';
import { DemoBadge, DemoNotice } from '@/components/DemoBadge';
import { MediaLibrary } from '@/components/media/MediaLibrary';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { PressableScale } from '@/components/ui/Pressables';
import { ProgressBar, ProgressRow } from '@/components/ui/Progress';
import { Screen, SectionHeader } from '@/components/ui/Screen';
import { CompatibilityBadge, placementStatusLabel, StatusBadge } from '@/components/ui/StatusBadge';
import { cn } from '@/lib/cn';
import { formatActivityDate } from '@/lib/foster-activity';
import { calculateFosterFamousScore } from '@/lib/foster-score';
import { useRecentFosterActivity } from '@/lib/use-foster-activity';
import { isContentPostStale, latestProgressUpdate, progressHistory } from '@/lib/foster-current-info';
import { isFutureFosterDate, normalizeFosterDate } from '@/lib/foster-date';
import { fosterDurationLabel, type FosterDuration } from '@/lib/foster-duration';
import { canReactivateAfterAdoption, completedFosterPeriods, currentFosterPeriod } from '@/lib/foster-lifecycle';
import { mediaUri, pickMediaFromLibrary } from '@/lib/media-storage';
import { goBackOrReplace } from '@/lib/navigation';
import { SPECIAL_PROMPTS } from '@/lib/options';
import { fullPostText } from '@/lib/share-content';
import { useAppStore, useDisplayFosters } from '@/lib/state/app-store';
import { colors, softShadow } from '@/lib/theme';
import type { Foster } from '@/lib/types';
import { useFosterDuration } from '@/lib/use-days-in-foster';

const SECTIONS = ['Overview', 'Media', 'Marketing', 'Adoption Bio', 'Progress'] as const;
type Section = (typeof SECTIONS)[number];

function formatRecordedDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function FosterProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; section?: string; action?: string }>();
  const fosters = useDisplayFosters();
  const requestedFoster = fosters.find((candidate) => candidate.id === params.id);
  // useDisplayFosters always provides samples when the local list is empty.
  const foster = requestedFoster ?? fosters[0]!;
  const isMissingFoster = !requestedFoster;

  const fosterDuration = useFosterDuration(foster);
  const recentActivity = useRecentFosterActivity(foster);
  const saveMediaAssets = useAppStore((s) => s.saveMediaAssets);
  const successPhotoUri = useAppStore((s) => {
    const item = s.mediaItems.find((media) => media.id === foster.successStoryPhotoMediaId && !media.deletedAt);
    return item ? mediaUri(item, true) : null;
  });
  const setFosterProfilePhotoFromMedia = useAppStore((s) => s.setFosterProfilePhotoFromMedia);
  const reactivateFoster = useAppStore((s) => s.reactivateFoster);
  const isAdopted = foster.adoptionStatus === 'Adopted';
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [reactivationOpen, setReactivationOpen] = useState<boolean>(false);
  const profilePhotoMutation = useMutation({
    mutationFn: async () => {
      const result = await pickMediaFromLibrary('photo', 1);
      if (result.permissionDenied) return 'permission-denied' as const;
      if (result.canceled || !result.assets[0]) return 'canceled' as const;

      const saved = await saveMediaAssets({
        fosterId: foster.id,
        type: 'photo',
        assets: [result.assets[0]],
        source: 'profile',
        tags: ['profile'],
      });
      if (!saved[0] || !setFosterProfilePhotoFromMedia(foster.id, saved[0].id)) {
        throw new Error('The profile photo could not be linked to this foster.');
      }
      return 'saved' as const;
    },
    onMutate: () => setPhotoError(null),
    onSuccess: (status) => {
      if (status === 'permission-denied') {
        setPhotoError('Allow photo access to change this profile picture.');
      }
    },
    onError: () => {
      setPhotoError('We could not open your photo library. Please try again.');
    },
  });
  const { isPending: isSavingProfilePhoto, mutate: pickProfilePhoto } = profilePhotoMutation;
  const profilePhotoActionStarted = useRef<boolean>(false);

  useEffect(() => {
    if (isMissingFoster || params.action !== 'profile-photo' || profilePhotoActionStarted.current || foster.isDemo) return;
    profilePhotoActionStarted.current = true;
    pickProfilePhoto();
  }, [foster.isDemo, isMissingFoster, params.action, pickProfilePhoto]);

  const initialSection = useMemo<Section>(() => {
    const match = SECTIONS.find((s) => s === params.section);
    return match ?? 'Overview';
  }, [params.section]);

  const [section, setSection] = useState<Section>(initialSection);
  const heroPhotoUri = isAdopted ? successPhotoUri ?? foster.photoUri : foster.photoUri;

  if (isMissingFoster) {
    return (
      <Screen testID="missing-foster-screen" edges={['top', 'bottom']}>
        <View className="flex-1 justify-center px-5">
          <EmptyState
            testID="missing-foster"
            icon={<PawPrint size={28} color={colors.forest} strokeWidth={2.2} />}
            title="We couldn’t find that foster."
            body="Your other foster information is safe. Choose a foster from your list or add a new profile."
            actionLabel="View Fosters"
            onAction={() => router.replace('/(tabs)/fosters')}
          />
        </View>
      </Screen>
    );
  }

  return (
    <View className="flex-1 bg-cream">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View className="h-[360px] w-full">
          {heroPhotoUri ? (
            <Image
              source={{ uri: heroPhotoUri }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              transition={220}
            />
          ) : (
            <View className="h-full w-full items-center justify-center bg-beige">
              {foster.species === 'cat' ? <Cat size={52} color={colors.inkMuted} /> : <Dog size={52} color={colors.inkMuted} />}
            </View>
          )}
          <LinearGradient
            colors={['rgba(11,42,26,0.55)', 'rgba(11,42,26,0)', 'rgba(11,42,26,0.86)']}
            locations={[0, 0.4, 1]}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />

          <View className="absolute left-5 top-14 flex-row items-center">
            <PressableScale
              testID="foster-back"
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => goBackOrReplace(router, '/(tabs)/fosters')}
              className="h-11 w-11 items-center justify-center rounded-full bg-cream/95">
              <ChevronLeft size={22} color={colors.forest} strokeWidth={2.6} />
            </PressableScale>
            {foster.isDemo ? (
              <View className="ml-3">
                <DemoBadge />
              </View>
            ) : null}
          </View>

          {!foster.isDemo ? (
            <PressableScale
              testID="foster-change-photo"
              accessibilityRole="button"
              accessibilityLabel="Change profile photo"
              accessibilityState={{ disabled: isSavingProfilePhoto }}
              disabled={isSavingProfilePhoto}
              onPress={() => pickProfilePhoto()}
              className="absolute right-5 top-14 h-11 w-11 items-center justify-center rounded-full bg-cream/95">
              <Camera size={19} color={colors.forest} strokeWidth={2.4} />
            </PressableScale>
          ) : null}

          <Animated.View entering={FadeIn.duration(500)} className="absolute bottom-5 left-5 right-5">
            <View className="mb-2.5 h-7 flex-row items-center self-start rounded-full bg-cream/95 px-2.5">
              <PawPrint size={12} color={colors.forest} strokeWidth={2.6} />
              <Text className="ml-1.5 font-bold text-xs uppercase tracking-[1px] text-forest">
                {fosterDurationLabel(fosterDuration, isAdopted)}
              </Text>
            </View>
            <Text className="font-display text-4xl uppercase leading-[44px] tracking-[1px] text-cream">
              {foster.name}
            </Text>
            <Text className="mt-1 font-medium text-base text-cream/80">
              {foster.species === 'dog' ? 'Dog' : 'Cat'} · {foster.breed || 'Breed unknown'} ·{' '}
              {foster.age || 'Age unknown'}
            </Text>
            <View className="mt-3">
              <StatusBadge status={foster.adoptionStatus} />
            </View>
          </Animated.View>
        </View>

        {/* Everyday marketing actions pause when an adoption is complete. */}
        {isAdopted ? (
          <View testID="adopted-foster-actions" className="px-5 pt-5">
            <View className="rounded-3xl bg-forest-soft p-4">
              <Text className="font-display text-xl text-forest">Adoption archived 🎉</Text>
              <Text className="mt-1 font-sans text-sm leading-[20px] text-ink-soft">
                {foster.name}'s posts, media, tracker, and foster history are safely preserved. Marketing tools are paused.
              </Text>
              <Button
                testID="reactivate-foster"
                label="Reactivate Foster"
                className="mt-4"
                icon={<RotateCcw size={17} color={colors.cream} strokeWidth={2.4} />}
                onPress={() => setReactivationOpen(true)}
              />
            </View>
          </View>
        ) : (
          <View className="flex-row gap-3 px-5 pt-5">
            <View className="flex-1">
              <Button
                testID="foster-create-post"
                label="Create Post"
                icon={<Sparkles size={17} color={colors.cream} strokeWidth={2.4} />}
                onPress={() =>
                  router.push({
                    pathname: '/create/editor',
                    params: { kind: 'Social Media Post', fosterId: foster.id },
                  })
                }
              />
            </View>
            <View className="flex-1">
              <Button
                testID="foster-add-update"
                label="Add Update"
                variant="secondary"
                disabled={foster.isDemo}
                icon={<Plus size={18} color={colors.forest} strokeWidth={2.6} />}
                onPress={() => router.push({ pathname: '/foster/update', params: { fosterId: foster.id } })}
              />
            </View>
          </View>
        )}
        <View className="px-5 pt-3">
          <Button
            testID="foster-edit-profile"
            label={foster.isDemo ? 'Add Your Foster' : 'Edit Profile'}
            variant="outline"
            size="md"
            icon={<Pencil size={16} color={colors.forest} strokeWidth={2.4} />}
            onPress={() =>
              router.push(
                foster.isDemo
                  ? '/foster/wizard'
                  : { pathname: '/foster/wizard', params: { id: foster.id } }
              )
            }
          />
        </View>

        {!foster.isDemo ? (
          <View testID="foster-current-information-card" className="px-5 pt-5">
            <Card tone="beige" raised={false}>
              <Text className="font-display text-xl text-forest">Current Status</Text>
              <Text testID="profile-current-status" className="mt-1.5 font-sans text-base leading-[22px] text-ink">
                {placementStatusLabel(foster.adoptionStatus)}
              </Text>
              <View className="mt-3">
                <StatusBadge status={foster.adoptionStatus} />
              </View>

              <View className="mt-5 border-t border-beige-dark/35 pt-4">
                <Text className="font-display text-lg text-forest">Recent Activity</Text>
                {recentActivity ? (
                  <View testID="profile-recent-activity" className="mt-3 border-l-2 border-clay pl-3">
                    <Text className="font-bold text-xs uppercase tracking-[1px] text-clay-deep">
                      Latest Activity · {formatActivityDate(recentActivity.occurredAt)}
                    </Text>
                    <Text className="mt-1 font-sans text-sm leading-[20px] text-ink-soft">
                      {recentActivity.title}
                    </Text>
                  </View>
                ) : (
                  <Text testID="profile-no-recent-activity" className="mt-2 font-sans text-sm leading-[20px] text-ink-muted">
                    No recent activity yet.
                  </Text>
                )}
              </View>
            </Card>
          </View>
        ) : null}

        {photoError ? (
          <Text
            testID="foster-photo-error"
            className="px-5 pt-3 text-center font-sans text-sm text-clay-deep">
            {photoError}
          </Text>
        ) : null}

        {foster.isDemo ? (
          <View className="px-5 pt-4">
            <DemoNotice text={`${foster.name} is a built-in sample so you can see how everything works. Add your own foster to replace it — sample details are never saved as yours.`} />
          </View>
        ) : null}

        {/* Section switcher */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 18, gap: 8 }}>
          {SECTIONS.map((s) => {
            const active = s === section;
            return (
              <PressableScale
                key={s}
                testID={`foster-section-${s.toLowerCase().replace(/\s+/g, '-')}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setSection(s)}
                scaleTo={0.96}
                className={cn(
                  'h-10 items-center justify-center rounded-full px-4',
                  active ? 'bg-forest' : 'border border-hairline bg-white'
                )}>
                <Text
                  className={cn('font-bold text-base', active ? 'text-cream' : 'text-ink-soft')}>
                  {s}
                </Text>
              </PressableScale>
            );
          })}
        </ScrollView>

        <Animated.View key={section} entering={FadeInDown.duration(320)} className="px-5">
          {section === 'Overview' ? (
            <OverviewSection foster={foster} duration={fosterDuration} />
          ) : section === 'Media' ? (
            <MediaSection foster={foster} />
          ) : section === 'Marketing' ? (
            <MarketingSection foster={foster} />
          ) : section === 'Adoption Bio' ? (
            <BioSection foster={foster} />
          ) : (
            <ProgressSection foster={foster} />
          )}
        </Animated.View>
      </ScrollView>
      <ReactivationModal
        foster={foster}
        visible={reactivationOpen}
        onCancel={() => setReactivationOpen(false)}
        onConfirm={(returnedAt) => {
          if (reactivateFoster(foster.id, returnedAt)) setReactivationOpen(false);
        }}
      />
    </View>
  );
}

function ReactivationModal({
  foster,
  visible,
  onCancel,
  onConfirm,
}: {
  foster: Foster;
  visible: boolean;
  onCancel: () => void;
  onConfirm: (returnedAt: string) => void;
}) {
  const [returnedAt, setReturnedAt] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setReturnedAt('');
    setError(null);
  }, [visible]);

  const confirm = () => {
    const normalized = normalizeFosterDate(returnedAt);
    if (!normalized) {
      setError('Enter the date they returned to foster care, such as Sep 10, 2026.');
      return;
    }
    if (isFutureFosterDate(normalized)) {
      setError('The return date cannot be in the future.');
      return;
    }
    if (!canReactivateAfterAdoption(foster, normalized)) {
      setError('The return date cannot be before the recorded adoption date.');
      return;
    }
    onConfirm(normalized);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 justify-end bg-forest-deep/50 px-4 pb-5">
        <View className="rounded-[32px] bg-cream p-5" style={softShadow}>
          <View className="mb-4 h-1.5 w-12 self-center rounded-full bg-beige-dark" />
          <Text className="font-display text-2xl text-forest">Reactivate {foster.name}?</Text>
          <Text className="mt-2 font-sans text-base leading-[22px] text-ink-muted">
            Their previous adoption and foster period will remain in history. This starts a new active foster period and resumes marketing tools.
          </Text>
          <Text className="mb-2 mt-5 font-bold text-base text-ink">Returned to foster care</Text>
          <TextInput
            testID="reactivate-foster-date"
            value={returnedAt}
            onChangeText={setReturnedAt}
            placeholder="Sep 10, 2026"
            placeholderTextColor={colors.inkMuted}
            style={{
              borderColor: colors.beigeDark,
              borderWidth: 1,
              borderRadius: 16,
              color: colors.ink,
              fontFamily: 'Nunito_600SemiBold',
              fontSize: 16,
              paddingHorizontal: 14,
              paddingVertical: 13,
            }}
          />
          {error ? <Text testID="reactivate-foster-error" className="mt-2 font-sans text-sm text-clay-deep">{error}</Text> : null}
          <Button testID="confirm-reactivate-foster" label="Reactivate Foster" className="mt-5" onPress={confirm} />
          <Button testID="cancel-reactivate-foster" label="Cancel" variant="secondary" className="mt-3" onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}

/* --------------------------------------------------------------- Overview */

function OverviewSection({ foster, duration }: { foster: Foster; duration: FosterDuration }) {
  const router = useRouter();
  const specials = SPECIAL_PROMPTS.filter((p) => foster.special[p.key]?.trim());
  const completedPeriods = completedFosterPeriods(foster);
  const currentPeriod = currentFosterPeriod(foster);

  return (
    <View>
      <Card tone="white" className="mb-4">
        <Text className="mb-3 font-display text-lg text-forest">Personality</Text>
        {foster.personality.length > 0 ? (
          <View className="flex-row flex-wrap gap-2">
            {foster.personality.map((trait) => (
              <Tag key={trait} label={trait} tone="beige" />
            ))}
          </View>
        ) : (
          <Text className="font-sans text-base text-ink-muted">Nothing recorded yet.</Text>
        )}
        {foster.personalityNotes ? (
          <Text className="mt-3.5 font-sans text-base leading-[22px] text-ink-soft">
            {foster.personalityNotes}
          </Text>
        ) : null}
      </Card>

      <Card tone="white" className="mb-4">
        <Text className="mb-1 font-display text-lg text-forest">Home compatibility</Text>
        <Text className="mb-4 font-sans text-sm leading-[19px] text-ink-muted">
          Unknown stays unknown. We never turn an unknown into a “good with” claim.
        </Text>
        <CompatRow label="Good with dogs" value={foster.goodWithDogs} />
        <CompatRow label="Good with cats" value={foster.goodWithCats} />
        <CompatRow label="Good with children" value={foster.goodWithChildren} />
        <CompatRow label="House-trained" value={foster.houseTrained} />
        <CompatRow label="Crate-trained" value={foster.crateTrained} isLast />
        {foster.childrenNotes ? (
          <View className="mt-4 rounded-2xl bg-cream-deep p-3.5">
            <Text className="font-bold text-sm text-forest">Note about children</Text>
            <Text className="mt-1 font-sans text-base leading-[21px] text-ink-soft">
              {foster.childrenNotes}
            </Text>
          </View>
        ) : null}
      </Card>

      <Card tone="white" className="mb-4">
        <Text className="mb-3.5 font-display text-lg text-forest">The basics</Text>
        <FactRow label="Sex" value={foster.sex} />
        <FactRow label="Size" value={foster.size ?? 'Unknown'} />
        <FactRow label="Weight" value={foster.weight || 'Unknown'} />
        <FactRow label="Energy level" value={foster.energyLevel ?? 'Unknown'} />
        <FactRow
          label="In foster since"
          value={duration.state === 'valid' ? currentPeriod?.startedAt ?? foster.fosterStartDate ?? 'Start date not set' : fosterDurationLabel(duration, foster.adoptionStatus === 'Adopted')}
          isLast
        />
        {duration.state !== 'valid' ? (
          <PressableScale
            testID="add-foster-start-date"
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/foster/wizard', params: { id: foster.id, step: '1' } })}
            className="mt-4 self-start">
            <Text className="font-bold text-sm text-forest underline">Add or correct start date</Text>
          </PressableScale>
        ) : null}
      </Card>

      {completedPeriods.length > 0 ? (
        <Card testID="foster-period-history" tone="beige" className="mb-4" raised={false}>
          <Text className="font-display text-lg text-forest">Foster & adoption history</Text>
          <Text className="mt-1 font-sans text-sm leading-[20px] text-ink-muted">
            Completed foster periods stay attached to this profile if {foster.name} returns.
          </Text>
          {completedPeriods.map((period, index) => (
            <View key={period.id} className="mt-4 border-l-2 border-clay pl-3">
              <Text className="font-bold text-xs uppercase tracking-[1px] text-clay-deep">
                Foster period {index + 1} · Adopted
              </Text>
              <Text className="mt-1 font-sans text-base text-ink-soft">
                {[
                  formatRecordedDate(period.startedAt)
                    ? `Started ${formatRecordedDate(period.startedAt)}`
                    : 'Start date not set',
                  formatRecordedDate(period.endedAt)
                    ? `Adopted ${formatRecordedDate(period.endedAt)}`
                    : 'Adoption date not recorded',
                ].join(' · ')}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}

      {specials.length > 0 ? (
        <Card tone="beige" className="mb-4">
          <Text className="mb-3.5 font-display text-lg text-forest">What makes them special</Text>
          {specials.map((p, i) => (
            <View key={p.key} className={i === specials.length - 1 ? undefined : 'mb-3.5'}>
              <Text className="font-extrabold text-xs uppercase tracking-[1.2px] text-clay-deep">
                {p.label}
              </Text>
              <Text className="mt-1 font-sans text-lg leading-[24px] text-ink">
                {foster.special[p.key]}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}

      {foster.considerations.length > 0 ? (
        <Card tone="clay" className="mb-4">
          <Text className="mb-1 font-display text-lg text-clay-deep">Things adopters should know</Text>
          <Text className="mb-3.5 font-sans text-sm leading-[19px] text-clay-deep/80">
            We never hide these. Being upfront finds the right home faster.
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {foster.considerations.map((c) => (
              <Tag key={c} label={c} tone="clay" />
            ))}
          </View>
        </Card>
      ) : null}

      <Card tone="white" className="mb-2">
        <Text className="mb-3.5 font-display text-lg text-forest">Adoption information</Text>
        <FactRow label="Rescue" value={foster.rescueName || 'Not added'} />
        <FactRow
          label="Location"
          value={[foster.city, foster.state].filter(Boolean).join(', ') || 'Not added'}
        />
        <FactRow label="Adoption fee" value={foster.adoptionFee || 'Not added'} />
        <FactRow label="Contact" value={foster.contactMethod || 'Not added'} />
        <FactRow label="Listing" value={foster.adoptionUrl || 'Not added'} isLast />
        <View className="mt-4 flex-row items-start rounded-2xl bg-cream-deep p-3.5">
          <MapPin size={16} color={colors.forest} strokeWidth={2.3} />
          <Text className="ml-2 flex-1 font-sans text-base leading-[21px] text-ink-soft">
            Only the rescue’s city is ever shown publicly. Your home address is never published.
          </Text>
        </View>
      </Card>
    </View>
  );
}

function CompatRow({
  label,
  value,
  isLast = false,
}: {
  label: string;
  value: Foster['goodWithDogs'];
  isLast?: boolean;
}) {
  return (
    <View
      className={cn(
        'flex-row items-center justify-between py-2.5',
        isLast ? undefined : 'border-b border-hairline/60'
      )}>
      <Text className="font-medium text-lg text-ink-soft">{label}</Text>
      <CompatibilityBadge value={value} />
    </View>
  );
}

function FactRow({
  label,
  value,
  isLast = false,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View
      className={cn(
        'flex-row items-center justify-between py-2.5',
        isLast ? undefined : 'border-b border-hairline/60'
      )}>
      <Text className="font-medium text-lg text-ink-soft">{label}</Text>
      <Text className="ml-4 flex-1 text-right font-bold text-lg text-ink" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ Media */

function MediaSection({ foster }: { foster: Foster }) {
  const router = useRouter();

  return (
    <MediaLibrary
      foster={foster}
      onOpenMedia={(mediaId) =>
        router.push({ pathname: '/media/[id]', params: { id: mediaId, fosterId: foster.id } })
      }
    />
  );
}

/* -------------------------------------------------------------- Marketing */

function MarketingSection({ foster }: { foster: Foster }) {
  const router = useRouter();
  const contentPosts = useAppStore((state) => state.contentPosts);
  const boostCampaigns = useAppStore((state) => state.adoptionBoostCampaigns);
  const boostTasks = useAppStore((state) => state.adoptionBoostTasks);
  const activeBoost = boostCampaigns.find(
    (campaign) => campaign.petId === foster.id && campaign.status === 'Active'
  );
  const recentBoostActions = boostTasks.filter(
    (task) => task.petId === foster.id && task.status === 'Completed'
  ).length;
  const fosterPosts = contentPosts
    .filter((post) => post.petId === foster.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const isAdopted = foster.adoptionStatus === 'Adopted';

  return (
    <View>
      {isAdopted ? (
        <Card tone="beige" raised={false}>
          <Text className="font-display text-xl text-forest">Marketing is archived</Text>
          <Text className="mt-1 font-sans text-sm leading-[20px] text-ink-soft">
            Existing saved content and confirmed history remain here. Reactivate {foster.name} if they return to foster care.
          </Text>
        </Card>
      ) : (
        <AdoptionBoostCard foster={foster} compact />
      )}
      {!isAdopted && (activeBoost || recentBoostActions > 0) ? (
        <PressableScale
          testID="profile-adoption-boost-status"
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/adoption-boost', params: { fosterId: foster.id } })}
          className="mt-3 flex-row items-center rounded-3xl border border-hairline bg-white p-4">
          <View className="h-10 w-10 items-center justify-center rounded-2xl bg-forest-soft">
            <PawPrint size={18} color={colors.forest} strokeWidth={2.5} />
          </View>
          <View className="ml-3 flex-1">
            <Text className="font-bold text-base text-ink">
              {activeBoost ? `7-Step Boost · Step ${activeBoost.currentDay} of 7` : 'Recent Boost actions'}
            </Text>
            <Text className="mt-0.5 font-sans text-sm text-ink-muted">
              {activeBoost
                ? 'One focused action is ready whenever you are.'
                : `${recentBoostActions} completed action${recentBoostActions === 1 ? '' : 's'} for ${foster.name}.`}
            </Text>
          </View>
        </PressableScale>
      ) : null}
      {!isAdopted ? (
        <Button
          testID="profile-open-adoption-boost"
          label="Open Adoption Boost"
          variant="secondary"
          className="mb-6 mt-3"
          onPress={() => router.push({ pathname: '/adoption-boost', params: { fosterId: foster.id } })}
        />
      ) : null}
      <SectionHeader title="Saved Content" action={`${fosterPosts.length} items`} />
      <Button
        testID="profile-open-saved-content"
        label={`View ${foster.name}'s Saved Content`}
        variant="secondary"
        size="md"
        className="mb-4 mt-2"
        onPress={() => router.push({ pathname: '/create/saved', params: { fosterId: foster.id } })}
      />
      {fosterPosts.length === 0 ? (
        <EmptyState
          testID="marketing-empty"
          icon={<Sparkles size={22} color={colors.forest} strokeWidth={2.2} />}
          title="Nothing created yet."
          body={isAdopted ? `Past posts for ${foster.name} remain safe here. Reactivate this profile to create new marketing content.` : `Create an accurate, foster-specific post for ${foster.name}.`}
          actionLabel={isAdopted ? undefined : 'Create a Post'}
          onAction={isAdopted ? undefined : () =>
            router.push({
              pathname: '/create/editor',
              params: { kind: 'Social Media Post', fosterId: foster.id },
            })
          }
        />
      ) : (
        <View>
          {fosterPosts.slice(0, 5).map((post) => (
            <PressableScale
              key={post.id}
              testID={`profile-content-${post.id}`}
              onPress={() =>
                router.push({ pathname: '/create/editor', params: { draftId: post.id } })
              }
              className="mb-3 rounded-3xl border border-hairline bg-white p-4">
              <View className="flex-row items-center justify-between">
                <Text className="flex-1 pr-3 font-bold text-lg text-ink">{post.contentType}</Text>
                <View className="rounded-full bg-forest-soft px-2.5 py-1">
                  <Text className="font-bold text-xs text-forest">{post.status}</Text>
                </View>
              </View>
              <Text className="mt-1.5 font-sans text-base leading-[21px] text-ink-muted" numberOfLines={2}>
                {post.hook || post.caption}
              </Text>
              {isContentPostStale(post, foster) ? (
                <Text testID={`profile-content-stale-${post.id}`} className="mt-2 font-bold text-sm text-clay-deep">
                  Current information changed — refresh before posting.
                </Text>
              ) : null}
            </PressableScale>
          ))}
          {!isAdopted ? (
            <Button
              testID="marketing-create-new"
              label="Create New Post"
              onPress={() =>
                router.push({
                  pathname: '/create/editor',
                  params: { kind: 'Social Media Post', fosterId: foster.id },
                })
              }
            />
          ) : null}
        </View>
      )}
      <Card tone="white" className="mt-4">
        <Text className="mb-1 font-display text-lg text-forest">Past Posts</Text>
        <Text className="font-sans text-base leading-[21px] text-ink-muted">
          {isAdopted
            ? 'Confirmed shares remain in this profile’s Marketing Activity. Saved Content stays available to review and edit.'
            : 'Confirmed shares are saved in the Marketing Activity. Open Saved Content to share again, edit, archive, or prepare another post.'}
        </Text>
        <Button
          testID="marketing-open-tracker"
          label="Open Marketing Activity"
          variant="secondary"
          size="md"
          className="mt-4"
          onPress={() => router.push({ pathname: '/tools/marketing-tracker', params: { fosterId: foster.id } })}
        />
      </Card>
    </View>
  );
}

/* ------------------------------------------------------------ Adoption bio */

function BioSection({ foster }: { foster: Foster }) {
  const router = useRouter();
  const bioRevision = useAppStore((state) => {
    const newest = state.contentPosts
      .filter((post) => post.petId === foster.id && post.contentType === 'Adoption Bio' && post.status !== 'Archived')
      .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))[0];
    return newest ? `${newest.id}:${newest.updatedAt}` : '';
  });
  const [copied, setCopied] = useState<boolean>(false);
  const bio = useMemo(() => {
    if (!bioRevision) return undefined;
    return useAppStore.getState().contentPosts
      .filter((post) => post.petId === foster.id && post.contentType === 'Adoption Bio' && post.status !== 'Archived')
      .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))[0];
  }, [bioRevision, foster.id]);

  if (!bio) {
    return (
      <View>
        <EmptyState
          testID="adoption-bio-empty"
          icon={<Sparkles size={24} color={colors.forest} strokeWidth={2.2} />}
          title="No adoption bio yet."
          body="Create a factual, foster-specific bio when you are ready."
          actionLabel={foster.adoptionStatus === 'Adopted' ? undefined : 'Create Adoption Bio'}
          onAction={foster.adoptionStatus === 'Adopted' ? undefined : () => router.push({ pathname: '/create/editor', params: { kind: 'Adoption Bio', fosterId: foster.id } })}
        />
        {foster.adoptionStatus === 'Adopted' ? (
          <Card tone="beige" raised={false} className="mt-4">
            <Text className="font-bold text-base text-forest">Marketing is paused for this adopted foster.</Text>
            <Text className="mt-1 font-sans text-sm leading-[20px] text-ink-soft">Reactivate this profile if they return before creating new marketing content.</Text>
          </Card>
        ) : null}
      </View>
    );
  }

  const body = fullPostText(bio, foster);
  return (
    <View>
      <Card testID="adoption-bio-content" tone="white" className="mb-4">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="font-display text-lg text-forest">Adoption bio</Text>
          <View className="h-7 items-center justify-center rounded-full bg-forest-soft px-2.5">
            <Text className="font-bold text-xs uppercase tracking-[1px] text-forest">{bio.status}</Text>
          </View>
        </View>
        <Text className="font-sans text-lg leading-[26px] text-ink">{body || 'This saved bio has no text yet.'}</Text>
        <Text className="mt-4 font-bold text-xs text-ink-muted">Last updated {formatRecordedDate(bio.updatedAt) ?? 'recently'}</Text>
      </Card>
      <View className="flex-row flex-wrap gap-2">
        <Button testID="bio-edit" label="Edit" variant="secondary" size="md" onPress={() => router.push({ pathname: '/create/editor', params: { draftId: bio.id } })} />
        {foster.adoptionStatus !== 'Adopted' ? <Button testID="bio-improve" label="Rewrite / Improve" size="md" onPress={() => router.push({ pathname: '/create/editor', params: { draftId: bio.id } })} /> : null}
        <Button
          testID="bio-copy"
          label={copied ? 'Copied' : 'Copy'}
          variant="outline"
          size="md"
          onPress={() => { void Clipboard.setStringAsync(body); setCopied(true); }}
        />
      </View>
      {foster.adoptionStatus !== 'Adopted' ? (
        <Button testID="bio-share" label="Share" className="mt-3" onPress={() => router.push({ pathname: '/share/[postId]', params: { postId: bio.id } })} />
      ) : null}
    </View>
  );
}

/* --------------------------------------------------------------- Progress */

function ProgressSection({ foster }: { foster: Foster }) {
  const router = useRouter();
  const mediaItems = useAppStore((state) => state.mediaItems);
  const coachGoals = useAppStore((state) => state.coachGoals);
  const contentPosts = useAppStore((state) => state.contentPosts);
  const publicationRecords = useAppStore((state) => state.publicationRecords);
  const marketingActivities = useAppStore((state) => state.marketingActivities);
  const liveScore = calculateFosterFamousScore({ foster, mediaItems, coachGoals, contentPosts, publicationRecords, marketingActivities });
  const latestActivity = useRecentFosterActivity(foster);
  const latestProgress = latestProgressUpdate(foster);
  const history = progressHistory(foster);

  return (
    <View>
      <Card tone="beige" className="mb-4" raised={false}>
        <Text className="font-display text-xl text-forest">Current information</Text>
        <Text className="mt-1 font-sans text-sm leading-[20px] text-ink-muted">
          This is what future drafts use first. Older notes and saved drafts do not override it.
        </Text>
        <View className="mt-4 rounded-2xl bg-white p-4">
          <Text className="font-extrabold text-xs uppercase tracking-[1.1px] text-clay-deep">Current status</Text>
          <Text testID="foster-current-status" className="mt-1 font-sans text-base leading-[22px] text-ink">
            {placementStatusLabel(foster.adoptionStatus)}
          </Text>
          {latestActivity ? (
            <>
              <Text className="mt-4 font-extrabold text-xs uppercase tracking-[1.1px] text-clay-deep">Latest activity</Text>
              <Text testID="foster-latest-activity" className="mt-1 font-sans text-base leading-[22px] text-ink">
                {latestActivity.title} · {formatActivityDate(latestActivity.occurredAt)}
              </Text>
            </>
          ) : (
            <Text testID="foster-no-recent-activity" className="mt-4 font-sans text-sm leading-[20px] text-ink-muted">
              No recent activity yet.
            </Text>
          )}
          {latestProgress ? (
            <>
              <Text className="mt-4 font-extrabold text-xs uppercase tracking-[1.1px] text-clay-deep">Latest foster update</Text>
              <Text testID="foster-latest-progress" className="mt-1 font-sans text-base leading-[22px] text-ink">{latestProgress.summary}</Text>
            </>
          ) : null}
        </View>
        {foster.adoptionStatus !== 'Adopted' ? (
          <Button
            testID="add-progress-update"
            label={latestProgress ? 'Add Foster Update' : 'Record Foster Update'}
            size="md"
            className="mt-4"
            onPress={() => router.push({ pathname: '/foster/update', params: { fosterId: foster.id } })}
          />
        ) : null}
      </Card>

      {history.length > 0 ? (
        <Card tone="white" className="mb-4" raised={false}>
          <Text className="font-display text-xl text-forest">Progress history</Text>
          <Text className="mt-1 font-sans text-sm leading-[20px] text-ink-muted">Recorded milestones stay here for reference. The newest update is used first.</Text>
          {history.map((update) => {
            const date = new Date(update.occurredAt || update.createdAt);
            const dateLabel = Number.isNaN(date.getTime()) ? 'Earlier saved progress' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
            return <View key={update.id} className="mt-4 border-l-2 border-clay pl-3"><Text className="font-bold text-xs uppercase tracking-[1px] text-clay-deep">{dateLabel} · {update.category}</Text><Text className="mt-1 font-sans text-base leading-[22px] text-ink">{update.summary}</Text></View>;
          })}
        </Card>
      ) : null}

      <View testID="foster-famous-score" className="mb-4 rounded-4xl bg-forest p-5" style={softShadow}>
        <Text className="font-bold text-lg text-cream">{foster.name}’s Foster Famous Score</Text>
        <Text className="mb-3 mt-1 font-display text-4xl text-cream">{liveScore.overall} / 100</Text>
        <ProgressBar value={liveScore.overall} tone="cream" height={9} />
      </View>

      <Card tone="white">
        <Text className="mb-4 font-display text-lg text-forest">What’s driving the score</Text>
        {liveScore.categories.map((category, index) => (
          <View key={category.key} className={index === liveScore.categories.length - 1 ? undefined : 'mb-3.5'}>
            <ProgressRow label={`${category.label} · ${category.earned}/${category.possible}`} value={(category.earned / category.possible) * 100} delay={index * 80} />
          </View>
        ))}
        <View className="mt-5 rounded-2xl bg-forest-soft p-4">
          <Text className="font-extrabold text-xs uppercase tracking-[1px] text-forest">Biggest opportunity</Text>
          <Text testID="score-biggest-opportunity" className="mt-1 font-sans text-base leading-[21px] text-ink-soft">{liveScore.biggestOpportunity}</Text>
          {foster.adoptionStatus !== 'Adopted' ? <Button testID="score-improve-action" label="Improve My Score" size="md" className="mt-4" onPress={() => {
            if (liveScore.destination === 'profile') router.push({ pathname: '/foster/wizard', params: { id: foster.id } });
            else if (liveScore.destination === 'photo-coach') router.push({ pathname: '/tools/photo-coach', params: { fosterId: foster.id, ...liveScore.destinationParams } });
            else if (liveScore.destination === 'video-coach') router.push({ pathname: '/tools/video-coach', params: { fosterId: foster.id } });
            else if (liveScore.destination === 'adoption-bio') router.push({ pathname: '/create/editor', params: { fosterId: foster.id, kind: 'Adoption Bio' } });
            else router.push({ pathname: '/create/editor', params: { fosterId: foster.id, source: 'idea', ...liveScore.destinationParams } });
          }} /> : <Text className="mt-3 font-sans text-sm leading-[20px] text-ink-muted">This historical score is preserved without an active marketing prompt.</Text>}
        </View>
      </Card>
    </View>
  );
}
