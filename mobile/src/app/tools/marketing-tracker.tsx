import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ClipboardList, Plus, X } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { DemoNotice } from '@/components/DemoBadge';
import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/Pressables';
import { Screen, ScreenHeader, SectionHeader } from '@/components/ui/Screen';
import { findFoster, useActiveFoster, useAppStore, useDisplayFosters } from '@/lib/state/app-store';
import { goBackOrReplace } from '@/lib/navigation';
import { colors, liftedShadow, softShadow } from '@/lib/theme';
import type { MarketingActivity } from '@/lib/types';

function formatActivityDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const SAMPLE_ACTIVITY: readonly Pick<MarketingActivity, 'id' | 'platform' | 'contentType' | 'summary' | 'occurredAt' | 'source' | 'outcomes'>[] = [
  { id: 'sample-1', platform: 'Facebook', contentType: 'Photo post', summary: 'A sample introduction post', occurredAt: '2026-08-21T12:00:00.000Z', source: 'publication' },
  { id: 'sample-2', platform: 'Instagram', contentType: 'Reel / TikTok Script', summary: 'A sample personality video', occurredAt: '2026-08-19T12:00:00.000Z', source: 'publication' },
  { id: 'sample-3', platform: 'Local Community', contentType: 'Local Community Post', summary: 'A sample local share', occurredAt: '2026-08-17T12:00:00.000Z', source: 'manual' },
];

export default function MarketingTrackerScreen() {
  const router = useRouter();
  const { fosterId } = useLocalSearchParams<{ fosterId?: string }>();
  const fallbackFoster = useActiveFoster();
  const fosters = useDisplayFosters();
  const activeFoster = fosterId ? findFoster(fosters, fosterId) : fallbackFoster;
  const marketingActivities = useAppStore((state) => state.marketingActivities);
  const addManualMarketingActivity = useAppStore((state) => state.addManualMarketingActivity);
  const [manualOpen, setManualOpen] = useState<boolean>(false);
  const [manualPlatform, setManualPlatform] = useState<string>('Facebook');
  const [manualContentType, setManualContentType] = useState<string>('Post');
  const [manualSummary, setManualSummary] = useState<string>('');
  const [inquiryReceived, setInquiryReceived] = useState<boolean>(false);
  const [applicationReceived, setApplicationReceived] = useState<boolean>(false);
  const [meetAndGreetInterest, setMeetAndGreetInterest] = useState<boolean>(false);
  const [outcomeNotes, setOutcomeNotes] = useState<string>('');
  const activities = useMemo(
    () => marketingActivities.filter((activity) => activity.petId === activeFoster.id).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    [activeFoster.id, marketingActivities]
  );
  const isAdopted = activeFoster.adoptionStatus === 'Adopted';
  const displayActivities: readonly Pick<MarketingActivity, 'id' | 'platform' | 'contentType' | 'summary' | 'occurredAt' | 'source' | 'outcomes'>[] = activeFoster.isDemo ? SAMPLE_ACTIVITY : activities;
  const recentWeekCount = activities.filter((activity) => Date.now() - new Date(activity.occurredAt).getTime() <= 7 * 86_400_000).length;
  const inquiryCount = activities.filter((activity) => activity.outcomes?.inquiryReceived).length;

  const saveManualActivity = () => {
    if (isAdopted || !manualSummary.trim()) return;
    addManualMarketingActivity({
      petId: activeFoster.id,
      platform: manualPlatform,
      contentType: manualContentType,
      summary: manualSummary,
      outcomes: { inquiryReceived, applicationReceived, meetAndGreetInterest, notes: outcomeNotes.trim() },
    });
    setManualOpen(false);
    setManualSummary('');
    setInquiryReceived(false);
    setApplicationReceived(false);
    setMeetAndGreetInterest(false);
    setOutcomeNotes('');
  };

  return (
    <Screen testID="marketing-activity-screen" edges={['top']}>
      <ScreenHeader title="Marketing Activity" onBack={() => goBackOrReplace(router, '/(tabs)/more')} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 44 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(400)}>
          <Text className="font-display text-3xl leading-[40px] text-forest">Promotion, remembered.</Text>
          <Text className="mt-1.5 font-sans text-lg leading-[24px] text-ink-soft">Keep a truthful record of where and how you have promoted {activeFoster.name}.</Text>
        </Animated.View>

        {activeFoster.isDemo ? (
          <View className="my-5"><DemoNotice text="SAMPLE DATA · This is an example activity history, not social-network analytics. Sample actions are never saved." /></View>
        ) : (
          <View className="my-5 rounded-3xl bg-forest-soft px-4 py-3">
            <Text className="font-bold text-base text-forest">{activeFoster.name}’s activity history</Text>
            <Text className="mt-1 font-sans text-sm leading-[20px] text-ink-soft">{isAdopted ? 'This history is preserved with the adopted profile. New activity is paused.' : 'Confirmed shares appear automatically. You can also log a post made outside Foster Famous.'}</Text>
          </View>
        )}

        {!activeFoster.isDemo && activities.length > 0 ? (
          <View className="mb-6 flex-row gap-3">
            <ActivitySummary label="Confirmed shares this week" value={String(recentWeekCount)} />
            <ActivitySummary label="User-reported inquiries" value={String(inquiryCount)} />
          </View>
        ) : null}

        <SectionHeader title="Recent Marketing Activity" />
        {displayActivities.length > 0 ? (
          <View testID="marketing-activity-list" className="mt-2">
            {displayActivities.map((activity) => (
              <View key={activity.id} className="mb-3 rounded-3xl border border-hairline bg-white p-4" style={softShadow}>
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-3">
                    <Text className="font-bold text-lg text-ink">{activity.platform} · {activity.contentType}</Text>
                    <Text className="mt-1 font-sans text-sm leading-[20px] text-ink-muted" numberOfLines={2}>{activity.summary || 'Posted activity'}</Text>
                  </View>
                  <View className="rounded-full bg-forest-soft px-2.5 py-1"><Text className="font-bold text-xs text-forest">{activity.source === 'manual' ? 'Manual' : 'Confirmed'}</Text></View>
                </View>
                <Text className="mt-3 font-bold text-xs text-ink-muted">{formatActivityDate(activity.occurredAt)}{activity.source === 'manual' ? ' · Added manually' : ' · Confirmed shared'}</Text>
                {activity.outcomes && (activity.outcomes.inquiryReceived || activity.outcomes.applicationReceived || activity.outcomes.meetAndGreetInterest || activity.outcomes.notes) ? <OutcomeSummary activity={activity as MarketingActivity} /> : null}
              </View>
            ))}
          </View>
        ) : (
          <View testID="marketing-activity-empty" className="mt-2 rounded-3xl border border-dashed border-hairline bg-white px-6 py-9">
            <ClipboardList size={26} color={colors.forest} strokeWidth={2.2} />
            <Text className="mt-3 font-display text-xl text-forest">No activity recorded yet</Text>
            <Text className="mt-2 font-sans text-sm leading-[20px] text-ink-muted">{isAdopted ? 'This adopted profile has no confirmed posting history saved yet.' : 'Confirm a shared post or log an activity you posted another way.'}</Text>
          </View>
        )}
        {!activeFoster.isDemo && !isAdopted ? <Button testID="marketing-add-activity" label="Add Marketing Activity" variant="secondary" className="mt-4" icon={<Plus size={17} color={colors.forest} strokeWidth={2.4} />} onPress={() => setManualOpen(true)} /> : null}
        <Text className="mt-5 text-center font-sans text-sm leading-[19px] text-ink-muted">Foster Famous records only posts you confirm. It does not retrieve views, shares, or outcomes from social networks.</Text>
      </ScrollView>
      <ManualActivityModal visible={manualOpen ? !isAdopted : false} platform={manualPlatform} contentType={manualContentType} summary={manualSummary} inquiryReceived={inquiryReceived} applicationReceived={applicationReceived} meetAndGreetInterest={meetAndGreetInterest} outcomeNotes={outcomeNotes} onChangePlatform={setManualPlatform} onChangeContentType={setManualContentType} onChangeSummary={setManualSummary} onToggleInquiry={() => setInquiryReceived((value) => !value)} onToggleApplication={() => setApplicationReceived((value) => !value)} onToggleMeetAndGreet={() => setMeetAndGreetInterest((value) => !value)} onChangeOutcomeNotes={setOutcomeNotes} onSave={saveManualActivity} onClose={() => setManualOpen(false)} />
    </Screen>
  );
}

function ActivitySummary({ label, value }: { label: string; value: string }) {
  return <View className="flex-1 rounded-3xl bg-beige p-3"><Text className="font-display text-2xl text-forest">{value}</Text><Text className="mt-1 font-sans text-xs leading-[16px] text-ink-muted">{label}</Text></View>;
}

function OutcomeSummary({ activity }: { activity: MarketingActivity }) {
  const outcomes = activity.outcomes;
  if (!outcomes) return null;
  const labels = [outcomes.inquiryReceived ? 'Inquiry received' : null, outcomes.applicationReceived ? 'Application received' : null, outcomes.meetAndGreetInterest ? 'Meet-and-greet interest' : null].filter(Boolean);
  return <View className="mt-3 rounded-2xl bg-beige p-3"><Text className="font-extrabold text-xs uppercase tracking-[1px] text-forest">User-reported outcome</Text>{labels.length > 0 ? <Text className="mt-1 font-sans text-sm text-ink-soft">{labels.join(' · ')}</Text> : null}{outcomes.notes ? <Text className="mt-1 font-sans text-sm leading-[20px] text-ink-muted">{outcomes.notes}</Text> : null}</View>;
}

function ManualActivityModal({
  visible,
  platform,
  contentType,
  summary,
  inquiryReceived,
  applicationReceived,
  meetAndGreetInterest,
  outcomeNotes,
  onChangePlatform,
  onChangeContentType,
  onChangeSummary,
  onToggleInquiry,
  onToggleApplication,
  onToggleMeetAndGreet,
  onChangeOutcomeNotes,
  onSave,
  onClose,
}: {
  visible: boolean;
  platform: string;
  contentType: string;
  summary: string;
  inquiryReceived: boolean;
  applicationReceived: boolean;
  meetAndGreetInterest: boolean;
  outcomeNotes: string;
  onChangePlatform: (value: string) => void;
  onChangeContentType: (value: string) => void;
  onChangeSummary: (value: string) => void;
  onToggleInquiry: () => void;
  onToggleApplication: () => void;
  onToggleMeetAndGreet: () => void;
  onChangeOutcomeNotes: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal testID="manual-activity-modal" visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-forest-deep/55">
        <Pressable
          testID="manual-activity-backdrop"
          accessibilityRole="button"
          accessibilityLabel="Dismiss marketing activity form"
          className="absolute inset-0"
          onPress={onClose}
        />
        <KeyboardAvoidingView
          pointerEvents="box-none"
          className="flex-1 justify-end px-4"
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
          <View className="max-h-[94%] overflow-hidden rounded-[32px] bg-cream" style={liftedShadow}>
            <View className="border-b border-hairline px-5 pb-3 pt-4">
              <View className="flex-row items-center justify-between">
                <View className="h-1.5 w-12 rounded-full bg-beige-dark" />
                <Pressable
                  testID="manual-activity-close"
                  accessibilityRole="button"
                  accessibilityLabel="Close marketing activity form"
                  className="h-10 w-10 items-center justify-center rounded-full bg-beige"
                  hitSlop={8}
                  onPress={onClose}>
                  <X size={20} color={colors.forest} strokeWidth={2.5} />
                </Pressable>
              </View>
              <Text className="mt-1 font-display text-2xl text-forest">Add Marketing Activity</Text>
              <Text className="mt-1 font-sans text-sm leading-[20px] text-ink-muted">
                Use this for a post made outside Foster Famous.
              </Text>
            </View>

            <ScrollView
              testID="manual-activity-form-scroll"
              style={{ flexShrink: 1 }}
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <Text className="mb-2 font-bold text-sm text-ink">Platform</Text>
              <TextInput
                testID="manual-activity-platform"
                value={platform}
                onChangeText={onChangePlatform}
                placeholder="Facebook"
                placeholderTextColor={colors.inkMuted}
                returnKeyType="next"
                className="h-12 rounded-2xl border border-hairline bg-white px-4 font-sans text-base text-ink"
              />

              <Text className="mb-2 mt-4 font-bold text-sm text-ink">Content type</Text>
              <TextInput
                testID="manual-activity-content-type"
                value={contentType}
                onChangeText={onChangeContentType}
                placeholder="Post, Reel, Story…"
                placeholderTextColor={colors.inkMuted}
                returnKeyType="next"
                className="h-12 rounded-2xl border border-hairline bg-white px-4 font-sans text-base text-ink"
              />

              <Text className="mb-2 mt-4 font-bold text-sm text-ink">What did you share?</Text>
              <TextInput
                testID="manual-activity-summary"
                value={summary}
                onChangeText={onChangeSummary}
                placeholder="A short reminder for your history"
                placeholderTextColor={colors.inkMuted}
                multiline
                textAlignVertical="top"
                className="min-h-[76px] rounded-2xl border border-hairline bg-white px-4 py-3 font-sans text-base text-ink"
              />

              <Text className="mb-2 mt-4 font-bold text-sm text-ink">Optional user-reported outcome</Text>
              <View className="flex-row flex-wrap gap-2">
                <OutcomeToggle testID="manual-outcome-inquiry" label="Inquiry received" selected={inquiryReceived} onPress={onToggleInquiry} />
                <OutcomeToggle testID="manual-outcome-application" label="Application received" selected={applicationReceived} onPress={onToggleApplication} />
                <OutcomeToggle testID="manual-outcome-meet-greet" label="Meet-and-greet interest" selected={meetAndGreetInterest} onPress={onToggleMeetAndGreet} />
              </View>

              <TextInput
                testID="manual-outcome-notes"
                value={outcomeNotes}
                onChangeText={onChangeOutcomeNotes}
                placeholder="Optional notes"
                placeholderTextColor={colors.inkMuted}
                multiline
                textAlignVertical="top"
                className="mt-3 min-h-[62px] rounded-2xl border border-hairline bg-white px-4 py-3 font-sans text-base text-ink"
              />
            </ScrollView>

            <View className="border-t border-hairline bg-cream px-5 pb-4 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
              <Button
                testID="manual-activity-save"
                label="Save Activity"
                disabled={!summary.trim()}
                icon={<Check size={18} color={colors.cream} strokeWidth={2.5} />}
                onPress={onSave}
              />
              <Button
                testID="manual-activity-cancel"
                label="Cancel"
                variant="ghost"
                size="md"
                className="mt-2"
                onPress={onClose}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function OutcomeToggle({ testID, label, selected, onPress }: { testID: string; label: string; selected: boolean; onPress: () => void }) {
  return <PressableScale testID={testID} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={onPress} className={selected ? 'rounded-full bg-forest px-3 py-2' : 'rounded-full border border-hairline bg-white px-3 py-2'}><Text className={selected ? 'font-bold text-xs text-cream' : 'font-bold text-xs text-forest'}>{label}</Text></PressableScale>;
}
