import { useRouter } from 'expo-router';
import { Check, ChevronRight, MoveRight, Sparkles } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button, TinyButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PressableScale } from '@/components/ui/Pressables';
import { ProgressBar } from '@/components/ui/Progress';
import { Screen } from '@/components/ui/Screen';
import { cn } from '@/lib/cn';
import {
  createFosterPlan,
  FOSTER_FAMOUS_PLAN,
  orderedPlanTasks,
  type FosterPlanDefinition,
  type FosterPlanTaskState,
} from '@/lib/foster-plan';
import { useActiveFosters, useAppStore } from '@/lib/state/app-store';
import { colors, liftedShadow, softShadow } from '@/lib/theme';

export default function PlanScreen() {
  const router = useRouter();
  const activeFosters = useActiveFosters();
  const activeFosterId = useAppStore((state) => state.activeFosterId);
  const fosterPlans = useAppStore((state) => state.fosterPlans);
  const setTaskStatus = useAppStore((state) => state.setFosterPlanTaskStatus);
  const moveTask = useAppStore((state) => state.moveFosterPlanTask);
  const activeFoster = activeFosters.find((foster) => foster.id === activeFosterId) ?? activeFosters[0];
  const [moveTaskState, setMoveTaskState] = useState<FosterPlanTaskState | null>(null);

  const plan = activeFoster?.isDemo ? createFosterPlan() : fosterPlans[activeFoster?.id ?? ''];
  const orderedTasks = useMemo(() => orderedPlanTasks(plan), [plan]);
  const doneCount = orderedTasks.filter((task) => task.status === 'done').length;

  if (!activeFoster) {
    return (
      <Screen testID="plan-no-active-foster-screen">
        <View className="flex-1 justify-center px-5">
          <EmptyState
            testID="plan-no-active-foster"
            icon={<Sparkles size={28} color={colors.forest} strokeWidth={2.2} />}
            title="Your active plan is paused."
            body="The 30-Day Plan is ready when you have an active foster again. Previous plan history remains with Adopted / Archived fosters."
            actionLabel="View Adopted / Archived"
            onAction={() => router.push('/(tabs)/fosters')}
          />
        </View>
      </Screen>
    );
  }

  const definitionFor = (task: FosterPlanTaskState): FosterPlanDefinition =>
    FOSTER_FAMOUS_PLAN.find((definition) => definition.day === task.day) ?? FOSTER_FAMOUS_PLAN[0];

  const openAction = (definition: FosterPlanDefinition) => {
    const fosterId = activeFoster.id;
    switch (definition.destination) {
      case 'profile':
        router.push({ pathname: '/foster/[id]', params: { id: fosterId } });
        return;
      case 'photo-coach':
        router.push({ pathname: '/tools/photo-coach', params: { fosterId, goalId: definition.goalId } });
        return;
      case 'video-coach':
        router.push({ pathname: '/tools/video-coach', params: { fosterId } });
        return;
      case 'adoption-bio':
        router.push({ pathname: '/create/editor', params: { fosterId, kind: 'Adoption Bio' } });
        return;
      case 'update':
        router.push({ pathname: '/foster/update', params: { fosterId } });
        return;
      case 'saved-content':
        router.push({ pathname: '/create/saved', params: { fosterId } });
        return;
      case 'media':
        router.push({ pathname: '/foster/[id]', params: { id: fosterId, section: 'Media' } });
        return;
      case 'score':
        router.push({ pathname: '/foster/[id]', params: { id: fosterId, section: 'Progress' } });
        return;
      case 'create':
        router.push({
          pathname: '/create/editor',
          params: {
            fosterId,
            kind: definition.kind ?? 'Social Media Post',
            source: 'idea',
            context: definition.context,
            planDay: String(definition.day),
          },
        });
    }
  };

  return (
    <Screen testID="plan-screen">
      <View className="px-5 pb-4 pt-2">
        <Text className="font-display text-3xl leading-[40px] text-forest">30-Day Foster Famous Plan</Text>
        <Text className="mt-1.5 font-sans text-lg text-ink-soft">Small, useful steps for {activeFoster.name}.</Text>
        {activeFoster.isDemo ? (
          <Text testID="sample-plan-label" className="mt-2 font-bold text-sm text-clay-deep">SAMPLE PLAN · Progress is not saved</Text>
        ) : null}
      </View>

      <View className="mx-5 mb-5 rounded-4xl bg-forest p-5" style={softShadow}>
        <View className="mb-3 flex-row items-end justify-between">
          <Text className="font-bold text-lg text-cream">Your progress</Text>
          <Text testID="plan-progress" className="font-display text-2xl text-cream">{doneCount}/30</Text>
        </View>
        <ProgressBar value={(doneCount / 30) * 100} tone="cream" height={9} />
        <Text className="mt-3 font-sans text-base text-cream/75">Skip, move, or complete a task whenever it suits your day.</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {orderedTasks.map((task, index) => {
          const definition = definitionFor(task);
          const isDone = task.status === 'done';
          const isSkipped = task.status === 'skipped';
          const wasMoved = task.scheduledDay !== task.day;
          return (
            <Animated.View
              key={task.day}
              entering={FadeInDown.delay(24 * Math.min(index, 12)).duration(320)}
              className={cn('mb-3.5 rounded-4xl border p-4', isDone ? 'border-forest/25 bg-forest-soft' : isSkipped ? 'border-hairline bg-cream-deep' : 'border-hairline/60 bg-white')}
              style={isDone || isSkipped ? undefined : softShadow}>
              <View className="flex-row items-start">
                <View className={cn('h-12 w-12 items-center justify-center rounded-2xl', isDone ? 'bg-forest' : isSkipped ? 'bg-beige-dark' : 'bg-beige')}>
                  {isDone ? <Check size={20} color={colors.cream} strokeWidth={3.2} /> : <Text className={cn('font-display text-lg', isSkipped ? 'text-ink-muted' : 'text-forest')}>{task.scheduledDay}</Text>}
                </View>
                <View className="ml-3.5 flex-1">
                  <Text className="font-extrabold text-xs uppercase tracking-[1.4px] text-clay-deep">{wasMoved ? `Day ${task.scheduledDay} · moved from Day ${task.day}` : `Day ${task.day}`}</Text>
                  <Text className={cn('mt-0.5 font-bold text-lg', isDone || isSkipped ? 'text-ink-muted' : 'text-ink')}>{definition.title}</Text>
                  <Text className="mt-1 font-sans text-base leading-[21px] text-ink-muted">{definition.goal}</Text>
                  <View className="mt-2.5 h-7 items-center justify-center self-start rounded-full bg-beige px-2.5"><Text className="font-bold text-xs uppercase tracking-[0.8px] text-forest">{definition.format}</Text></View>
                </View>
              </View>
              {!activeFoster.isDemo ? (
                <View className="mt-4 flex-row flex-wrap gap-2">
                  <TinyButton testID={`plan-action-${task.day}`} label={definition.action} tone="clay" onPress={() => openAction(definition)} />
                  <TinyButton testID={`plan-complete-${task.day}`} label={isDone ? 'Completed' : 'Complete'} tone={isDone ? 'forest' : 'neutral'} onPress={() => setTaskStatus(activeFoster.id, task.day, isDone ? 'todo' : 'done')} />
                  <TinyButton testID={`plan-skip-${task.day}`} label={isSkipped ? 'Unskip' : 'Skip'} onPress={() => setTaskStatus(activeFoster.id, task.day, isSkipped ? 'todo' : 'skipped')} />
                  {!isDone && !isSkipped ? <TinyButton testID={`plan-move-${task.day}`} label="Move" onPress={() => setMoveTaskState(task)} /> : null}
                </View>
              ) : null}
            </Animated.View>
          );
        })}
      </ScrollView>
      <MoveTaskModal
        task={moveTaskState}
        definition={moveTaskState ? definitionFor(moveTaskState) : null}
        onClose={() => setMoveTaskState(null)}
        onMove={(targetDay) => {
          if (moveTaskState) moveTask(activeFoster.id, moveTaskState.day, targetDay);
          setMoveTaskState(null);
        }}
      />
    </Screen>
  );
}

function MoveTaskModal({ task, definition, onClose, onMove }: { task: FosterPlanTaskState | null; definition: FosterPlanDefinition | null; onClose: () => void; onMove: (targetDay: number) => void }) {
  if (!task || !definition) return null;
  const tomorrow = Math.min(30, task.scheduledDay + 1);
  const later = Math.min(30, task.scheduledDay + 2);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-forest-deep/55 px-4 pb-5">
        <View testID="move-plan-day-modal" className="rounded-[32px] bg-cream p-5" style={liftedShadow}>
          <View className="mb-4 h-1.5 w-12 self-center rounded-full bg-beige-dark" />
          <View className="flex-row items-center"><MoveRight size={20} color={colors.forest} strokeWidth={2.3} /><Text className="ml-2 font-display text-2xl text-forest">Move This Day</Text></View>
          <Text className="mt-2 font-sans text-base leading-[22px] text-ink-soft">{definition.title} stays in your plan. Moving swaps its position with the task already there, so nothing disappears.</Text>
          <Button testID="move-plan-tomorrow" label={`Move to Day ${tomorrow}`} className="mt-5" disabled={tomorrow === task.scheduledDay} onPress={() => onMove(tomorrow)} />
          <Button testID="move-plan-later" label={`Move Later · Day ${later}`} variant="secondary" className="mt-3" disabled={later === task.scheduledDay} onPress={() => onMove(later)} />
          <Text className="mb-2 mt-5 font-bold text-sm text-ink">Choose another day</Text>
          <View className="flex-row flex-wrap gap-2">{Array.from({ length: 30 }, (_, index) => index + 1).filter((day) => day !== task.scheduledDay).map((day) => <PressableScale key={day} testID={`move-plan-choose-${day}`} accessibilityRole="button" onPress={() => onMove(day)} className="h-10 min-w-10 items-center justify-center rounded-xl border border-hairline bg-white px-2"><Text className="font-bold text-sm text-forest">{day}</Text></PressableScale>)}</View>
          <Button testID="move-plan-cancel" label="Cancel" variant="ghost" size="md" className="mt-4" icon={<ChevronRight size={16} color={colors.forest} />} onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
