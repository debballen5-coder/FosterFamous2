import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ChevronRight, Lightbulb, PawPrint, SkipForward } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AdoptionBoostCard } from '@/components/AdoptionBoostCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PressableScale } from '@/components/ui/Pressables';
import { Screen, ScreenHeader, SectionHeader } from '@/components/ui/Screen';
import { BOOST_TASKS } from '@/lib/adoption-boost';
import { findFoster, useAppStore, useDisplayFosters } from '@/lib/state/app-store';
import { colors, softShadow } from '@/lib/theme';
import type { AdoptionBoostDestination, AdoptionBoostTask } from '@/lib/types';

function destinationForTask(taskType: AdoptionBoostTask['taskType']): AdoptionBoostDestination {
  return BOOST_TASKS.find((item) => item.taskType === taskType)?.destination ?? 'post-builder';
}

export default function AdoptionBoostScreen() {
  const router = useRouter();
  const { fosterId } = useLocalSearchParams<{ fosterId?: string }>();
  const fosters = useDisplayFosters();
  const foster = findFoster(fosters, fosterId);
  const campaigns = useAppStore((state) => state.adoptionBoostCampaigns);
  const tasks = useAppStore((state) => state.adoptionBoostTasks);
  const startCampaign = useAppStore((state) => state.startAdoptionBoostCampaign);
  const updateTask = useAppStore((state) => state.updateAdoptionBoostTask);
  const replaceTask = useAppStore((state) => state.replaceAdoptionBoostTask);
  const [success, setSuccess] = useState<string | null>(null);

  const activeCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.petId === foster.id && campaign.status === 'Active'),
    [campaigns, foster.id]
  );
  const campaignTasks = useMemo(
    () => activeCampaign ? tasks.filter((task) => task.campaignId === activeCampaign.id).sort((a, b) => a.day - b.day) : [],
    [activeCampaign, tasks]
  );
  const currentTask = campaignTasks.find((task) => task.status === 'Todo');
  const completedTasks = tasks
    .filter((task) => task.petId === foster.id && task.status === 'Completed')
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
    .slice(0, 4);

  const openTask = (task: AdoptionBoostTask) => {
    const definition = BOOST_TASKS.find((item) => item.taskType === task.taskType);
    const destination = destinationForTask(task.taskType);
    if (destination === 'photo-coach') {
      router.push({ pathname: '/tools/photo-coach', params: { fosterId: foster.id, ...definition?.destinationParams } });
    } else if (destination === 'video-coach') {
      router.push({ pathname: '/tools/video-coach', params: { fosterId: foster.id } });
    } else {
      router.push({ pathname: '/create/editor', params: { fosterId: foster.id, source: 'idea', ...definition?.destinationParams } });
    }
  };

  const completeTask = (task: AdoptionBoostTask) => {
    if (!activeCampaign) return;
    updateTask(activeCampaign.id, task.id, 'Completed');
    setSuccess(`That's one more way ${foster.name} can get noticed.`);
  };

  const skipTask = (task: AdoptionBoostTask, status: 'Skipped' | 'Replaced') => {
    if (!activeCampaign) return;
    updateTask(activeCampaign.id, task.id, status);
    setSuccess(status === 'Skipped' ? 'No problem — your Boost is still yours.' : 'Here is the next useful idea for today.');
  };

  return (
    <Screen testID="adoption-boost-screen" edges={['top']}>
      <ScreenHeader title="Adoption Boost" subtitle={`A simple next step for ${foster.name}`} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(360)}>
          <Text className="font-display text-3xl leading-[39px] text-forest">A little momentum, one day at a time.</Text>
          <Text className="mt-2 font-sans text-base leading-[23px] text-ink-soft">Foster Famous uses only the details and activity you have recorded. No social analytics, no pressure.</Text>
        </Animated.View>

        {success ? (
          <Animated.View entering={FadeInDown.duration(250)} testID="adoption-boost-success" className="mt-5 flex-row rounded-3xl bg-forest-soft p-4">
            <View className="h-10 w-10 items-center justify-center rounded-2xl bg-forest"><Check size={19} color={colors.cream} strokeWidth={3} /></View>
            <View className="ml-3 flex-1"><Text className="font-bold text-base text-forest">Nice work! 🐾</Text><Text className="mt-0.5 font-sans text-sm leading-[20px] text-ink-soft">{success}</Text></View>
          </Animated.View>
        ) : null}

        {foster.adoptionStatus === 'Adopted' ? (
          <View className="mt-6"><AdoptionBoostCard foster={foster} /></View>
        ) : activeCampaign ? (
          <Animated.View entering={FadeInDown.delay(80).duration(360)} className="mt-6">
            <View className="overflow-hidden rounded-5xl bg-clay-soft p-5" style={softShadow}>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center"><View className="h-10 w-10 items-center justify-center rounded-2xl bg-clay"><PawPrint size={19} color={colors.cream} strokeWidth={2.6} /></View><View className="ml-3"><Text className="font-extrabold text-xs uppercase tracking-[1.2px] text-clay-deep">Active campaign</Text><Text className="font-display text-2xl text-forest">7-Step Adoption Boost</Text></View></View>
                <Text className="font-bold text-sm text-clay-deep">Step {activeCampaign.currentDay} of 7</Text>
              </View>
              <View className="mt-5 h-2 overflow-hidden rounded-full bg-white/80"><View style={{ width: `${((activeCampaign.currentDay - 1) / 7) * 100}%` }} className="h-full rounded-full bg-clay" /></View>
              {currentTask ? <BoostTaskCard task={currentTask} fosterName={foster.name} onOpen={() => openTask(currentTask)} onComplete={() => completeTask(currentTask)} onSkip={() => skipTask(currentTask, 'Skipped')} onReplace={() => {
                const replacement = replaceTask(activeCampaign.id, currentTask.id);
                setSuccess(replacement ? 'A different useful step is ready — it was not marked complete.' : 'No unused alternative remains in this Boost. You can skip this one or come back later.');
              }} /> : null}
            </View>
            <Text className="mt-4 text-center font-sans text-sm leading-[19px] text-ink-muted">Complete, skip, or replace a task whenever it suits your day. There is no score to protect.</Text>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.delay(80).duration(360)} className="mt-6">
            <Card tone="beige" className="p-5">
              <Text className="font-display text-2xl text-forest">Need a fresh week of ideas?</Text>
              <Text className="mt-2 font-sans text-base leading-[23px] text-ink-soft">A 7-Step Adoption Boost connects you to the tools you already use — photos, videos, posts, and sharing — one focused action at a time.</Text>
              <Button testID="start-adoption-boost" label="Start 7-Step Adoption Boost" className="mt-5" onPress={() => { startCampaign(foster.id); setSuccess('Your 7-Step Adoption Boost is ready when you are.'); }} />
            </Card>
          </Animated.View>
        )}

        {foster.adoptionStatus !== 'Adopted' ? <View className="mt-6"><AdoptionBoostCard foster={foster} compact /></View> : null}

        {completedTasks.length > 0 ? (
          <View className="mt-8">
            <SectionHeader title="Recent Boost actions" />
            {completedTasks.map((task) => {
              const definition = BOOST_TASKS.find((item) => item.taskType === task.taskType);
              const date = task.completedAt ? new Date(task.completedAt) : null;
              return <View key={task.id} className="mb-3 flex-row items-center rounded-3xl border border-hairline bg-white p-4"><View className="h-10 w-10 items-center justify-center rounded-2xl bg-forest-soft"><Check size={18} color={colors.forest} strokeWidth={2.8} /></View><View className="ml-3 flex-1"><Text className="font-bold text-base text-ink">{definition?.title ?? 'Boost action'}</Text><Text className="mt-0.5 font-sans text-sm text-ink-muted">{date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Completed'}</Text></View></View>;
            })}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function BoostTaskCard({ task, fosterName, onOpen, onComplete, onSkip, onReplace }: { task: AdoptionBoostTask; fosterName: string; onOpen: () => void; onComplete: () => void; onSkip: () => void; onReplace: () => void; }) {
  const definition = BOOST_TASKS.find((item) => item.taskType === task.taskType);
  return (
    <View testID="adoption-boost-current-task" className="mt-6 rounded-4xl bg-white p-5">
      <Text className="font-extrabold text-xs uppercase tracking-[1.2px] text-clay-deep">Current Boost · Step {task.day} of 7</Text>
      <Text className="mt-1 font-display text-2xl text-forest">{definition?.title ?? 'Boost action'}</Text>
      <Text className="mt-2 font-sans text-base leading-[23px] text-ink-soft">{definition?.description.replace('your foster', fosterName) ?? 'Take one helpful next step.'}</Text>
      <Button testID="adoption-boost-task-action" label={definition?.actionLabel ?? 'Open'} className="mt-5" onPress={onOpen} />
      <View className="mt-3 flex-row gap-2"><View className="flex-1"><Button testID="adoption-boost-task-complete" label="Complete" size="md" variant="secondary" icon={<Check size={16} color={colors.forest} />} onPress={onComplete} /></View><View className="flex-1"><Button testID="adoption-boost-task-skip" label="Skip" size="md" variant="outline" icon={<SkipForward size={16} color={colors.forest} />} onPress={onSkip} /></View></View>
      <PressableScale testID="adoption-boost-task-replace" accessibilityRole="button" onPress={onReplace} className="mt-3 h-10 flex-row items-center justify-center"><Lightbulb size={16} color={colors.forest} strokeWidth={2.3} /><Text className="ml-1.5 font-bold text-sm text-forest underline">Give Me Another Idea</Text><ChevronRight size={15} color={colors.forest} strokeWidth={2.3} /></PressableScale>
    </View>
  );
}
