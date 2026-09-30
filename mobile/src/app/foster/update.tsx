import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { DemoNotice } from '@/components/DemoBadge';
import { Button, TinyButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/Field';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { findFoster, useAppStore, useDisplayFosters } from '@/lib/state/app-store';
import { placementStatusLabel } from '@/components/ui/StatusBadge';
import { isFutureFosterDate, normalizeFosterDate } from '@/lib/foster-date';
import { colors } from '@/lib/theme';
import { ADOPTION_STATUSES, type AdoptionStatus, type ProgressUpdateCategory } from '@/lib/types';

const UPDATE_CATEGORIES: readonly ProgressUpdateCategory[] = [
  'Medical',
  'Training',
  'Behavior',
  'Compatibility',
  'Milestone',
  'General Update',
];

const ACTION_BAR_TOP_PADDING = 10;
const ACTION_BAR_MIN_BOTTOM_PADDING = 12;
const ACTION_BUTTON_HEIGHT = 50;

export default function FosterUpdateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { fosterId } = useLocalSearchParams<{ fosterId?: string }>();
  const fosters = useDisplayFosters();
  const foster = findFoster(fosters, fosterId);
  const saveFosterProgressUpdate = useAppStore((state) => state.saveFosterProgressUpdate);
  const existingStatus = foster.currentStatus ?? '';
  const [category, setCategory] = useState<ProgressUpdateCategory>('General Update');
  const [summary, setSummary] = useState<string>('');
  const [changesCurrentStatus, setChangesCurrentStatus] = useState<boolean>(false);
  const [currentStatus, setCurrentStatus] = useState<string>(existingStatus);
  const [placementStatus, setPlacementStatus] = useState<AdoptionStatus>(foster.adoptionStatus);
  const [adoptionDate, setAdoptionDate] = useState<string>('');
  const [currentStatusEdited, setCurrentStatusEdited] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState<boolean>(false);
  const actionBarBottomPadding = Math.max(insets.bottom, ACTION_BAR_MIN_BOTTOM_PADDING);
  const stickyActionSpace = ACTION_BUTTON_HEIGHT + ACTION_BAR_TOP_PADDING + actionBarBottomPadding;

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => router.back(), 1250);
    return () => clearTimeout(timer);
  }, [router, saved]);

  const chooseStatusChange = (changes: boolean) => {
    setChangesCurrentStatus(changes);
    setCurrentStatusEdited(false);
    setCurrentStatus(changes ? summary || existingStatus : existingStatus);
  };

  const updateSummary = (value: string) => {
    setSummary(value);
    if (changesCurrentStatus && !currentStatusEdited) setCurrentStatus(value);
  };

  const save = () => {
    const placementChanged = placementStatus !== foster.adoptionStatus;
    const currentStatusChanged =
      changesCurrentStatus && currentStatus.trim() !== existingStatus.trim();
    if (!summary.trim() && !currentStatusChanged && !placementChanged) {
      setNotice('Add a brief update or change the placement status before saving.');
      return;
    }
    const normalizedAdoptionDate = placementStatus === 'Adopted' && foster.adoptionStatus !== 'Adopted'
      ? normalizeFosterDate(adoptionDate) ?? undefined
      : undefined;
    if (placementStatus === 'Adopted' && foster.adoptionStatus !== 'Adopted' && !normalizedAdoptionDate) {
      setNotice('Enter the adoption date before saving this update.');
      return;
    }
    if (normalizedAdoptionDate && isFutureFosterDate(normalizedAdoptionDate)) {
      setNotice('The adoption date cannot be in the future.');
      return;
    }
    const savedUpdate = saveFosterProgressUpdate(foster.id, {
      category,
      summary,
      currentStatus: changesCurrentStatus ? currentStatus : existingStatus,
      adoptionStatus: placementStatus,
      adoptionDate: normalizedAdoptionDate,
    });
    if (!savedUpdate) {
      setNotice('We could not save that update. Please try again.');
      return;
    }
    setNotice(null);
    setSaved(true);
  };

  // Saving an update can make this foster adopted. Preserve the confirmation
  // state before showing the adopted-profile guard so the action never appears
  // to fail or jump away from the form.
  if (saved) {
    return (
      <Screen testID="foster-update-saved-screen" edges={['top', 'bottom']}>
        <View className="flex-1 items-center justify-center px-8">
          <View className="h-16 w-16 items-center justify-center rounded-3xl bg-forest">
            <CheckCircle2 size={32} color={colors.cream} strokeWidth={2.5} />
          </View>
          <Text className="mt-5 text-center font-display text-3xl text-forest">{foster.name}’s update is saved</Text>
          <Text className="mt-2 text-center font-sans text-base leading-[23px] text-ink-soft">
            {foster.adoptionStatus === 'Adopted'
              ? `${foster.name}’s foster period is complete and their marketing is now paused.`
              : `Future posts will use ${foster.name}’s latest information.`}
          </Text>
        </View>
      </Screen>
    );
  }

  if (foster.adoptionStatus === 'Adopted') {
    return (
      <Screen testID="foster-update-adopted-screen" edges={['top']}>
        <ScreenHeader title="Marketing archived" onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center px-7 pb-20">
          <Text className="text-center font-display text-2xl text-forest">{foster.name}'s updates are preserved.</Text>
          <Text className="mt-2 text-center font-sans text-base leading-[22px] text-ink-muted">
            Current-information updates are paused while this foster is adopted. Reactivate the profile if they return.
          </Text>
          <Button
            testID="foster-update-adopted-profile"
            label="View Adopted Profile"
            className="mt-6"
            onPress={() => router.replace({ pathname: '/foster/[id]', params: { id: foster.id } })}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen testID="foster-update-screen" edges={['top']}>
      <ScreenHeader
        title={`What’s new with ${foster.name}?`}
        subtitle="Add a milestone or change so future posts stay current."
        onBack={() => router.back()}
      />

      <View className="flex-1">
        <ScrollView
          testID="foster-update-form-scroll"
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 4,
            paddingBottom: stickyActionSpace + 24,
          }}
          automaticallyAdjustKeyboardInsets
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {foster.isDemo ? <DemoNotice text="Sample fosters are read-only. Add your own foster to save a real update." /> : null}

          <View
            testID="foster-update-helper"
            className="rounded-2xl border border-forest/10 bg-forest-soft px-3.5 py-2.5">
            <Text className="font-bold text-sm text-forest">Keep future posts current</Text>
            <Text className="mt-0.5 font-sans text-xs leading-[17px] text-ink-soft">
              Updates you save here will be used in future Foster Famous content.
            </Text>
          </View>

          <Animated.View entering={FadeInDown.duration(220)} className="mt-3">
            <Card tone="white" raised={false} className="rounded-3xl p-4">
              <Text className="font-display text-lg text-forest">Update category</Text>
              <ScrollView
                horizontal
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                showsHorizontalScrollIndicator={false}
                style={{ flexGrow: 0 }}
                contentContainerStyle={{ gap: 8, paddingTop: 10, paddingRight: 4 }}>
                {UPDATE_CATEGORIES.map((item) => (
                  <TinyButton
                    key={item}
                    testID={`foster-update-category-${item.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                    label={item}
                    tone={category === item ? 'forest' : 'neutral'}
                    onPress={() => setCategory(item)}
                  />
                ))}
              </ScrollView>
            </Card>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(45).duration(220)} className="mt-3">
            <Card tone="beige" raised={false} className="rounded-3xl p-4">
              <TextField
                testID="foster-progress-update-input"
                label="What happened? (optional)"
                value={summary}
                onChangeText={updateSummary}
                placeholder="Valor had his surgery and is recovering well. He should be available for adoption soon."
                multiline
                returnKeyType="done"
                submitBehavior="blurAndSubmit"
              />
            </Card>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(90).duration(220)} className="mt-3">
            <Card tone="white" raised={false} className="rounded-3xl p-4">
              <Text className="font-display text-lg text-forest">Placement Status</Text>
              <Text testID="foster-update-placement-current" className="mt-2 font-sans text-sm leading-[20px] text-ink-muted">
                {placementStatus === foster.adoptionStatus
                  ? `Current placement: ${placementStatusLabel(foster.adoptionStatus)}`
                  : `This update will change placement to: ${placementStatusLabel(placementStatus)}`}
              </Text>
              <Text className="mt-4 font-bold text-base text-ink">Update placement status</Text>
              <ScrollView
                horizontal
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                showsHorizontalScrollIndicator={false}
                style={{ flexGrow: 0 }}
                contentContainerStyle={{ gap: 8, paddingTop: 10, paddingRight: 4 }}>
                {ADOPTION_STATUSES.map((status) => (
                  <TinyButton
                    key={status}
                    testID={`foster-update-placement-${status.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                    label={placementStatusLabel(status)}
                    tone={placementStatus === status ? 'forest' : 'neutral'}
                    onPress={() => setPlacementStatus(status)}
                  />
                ))}
              </ScrollView>
              <Text className="mt-3 font-sans text-xs leading-[17px] text-ink-muted">
                Choose Adopted to complete the foster period and pause marketing. Other placements keep the profile active.
              </Text>
              {placementStatus === 'Adopted' ? (
                <TextField
                  testID="foster-adoption-date"
                  label="Adoption date"
                  value={adoptionDate}
                  onChangeText={setAdoptionDate}
                  placeholder="Aug 15, 2026"
                  hint="This closes the current foster period and is kept in the adoption history."
                />
              ) : null}
            </Card>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(135).duration(220)} className="mt-3">
            <Card tone="white" raised={false} className="rounded-3xl p-4">
              <Text className="font-display text-lg text-forest">Latest Foster Summary</Text>
              <Text className="mt-2 font-sans text-sm leading-[20px] text-ink-muted">
                {existingStatus.trim() || `No summary has been saved for ${foster.name} yet.`}
              </Text>
              <Text className="mt-4 font-bold text-base text-ink">Use this update in future posts?</Text>
              <View className="mt-3 flex-row gap-2">
                <View className="flex-1">
                  <TinyButton
                    testID="foster-update-status-yes"
                    label="Yes"
                    tone={changesCurrentStatus ? 'forest' : 'neutral'}
                    onPress={() => chooseStatusChange(true)}
                  />
                </View>
                <View className="flex-1">
                  <TinyButton
                    testID="foster-update-status-no"
                    label="No"
                    tone={!changesCurrentStatus ? 'forest' : 'neutral'}
                    onPress={() => chooseStatusChange(false)}
                  />
                </View>
              </View>
              {changesCurrentStatus ? (
                <TextField
                  testID="foster-current-status-input"
                  label="Latest Foster Summary"
                  value={currentStatus}
                  onChangeText={(value) => {
                    setCurrentStatusEdited(true);
                    setCurrentStatus(value);
                  }}
                  placeholder="Surgery completed — recovering; expected to be available soon."
                  multiline
                  hint="Pre-filled from your update. Edit it to make a short, factual summary for future posts."
                />
              ) : null}
            </Card>
          </Animated.View>

          {notice ? <Text testID="foster-update-notice" className="mt-4 text-center font-sans text-sm text-clay-deep">{notice}</Text> : null}
        </ScrollView>

        <KeyboardStickyView
          testID="foster-update-action-bar"
          offset={{ closed: 0, opened: 0 }}
          style={{ flexShrink: 0 }}>
          <View
            className="border-t border-hairline bg-cream px-5 pt-2.5"
            style={{ paddingBottom: actionBarBottomPadding }}>
            <View className="flex-row items-center gap-2">
              <Button
                testID="cancel-foster-update"
                label="Cancel"
                variant="ghost"
                size="md"
                fullWidth={false}
                className="px-2"
                onPress={() => router.back()}
              />
              <View className="flex-1">
                <Button
                  testID="save-foster-update"
                  label="Save Update"
                  size="md"
                  icon={<CheckCircle2 size={18} color={colors.cream} strokeWidth={2.5} />}
                  disabled={foster.isDemo}
                  onPress={save}
                />
              </View>
            </View>
          </View>
        </KeyboardStickyView>
      </View>
    </Screen>
  );
}
