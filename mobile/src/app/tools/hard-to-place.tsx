import { useRouter } from 'expo-router';
import { Lightbulb, ListChecks } from 'lucide-react-native';
import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/ui/Button';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { HARD_TO_PLACE_PLAYBOOKS, type HardToPlaceAction } from '@/lib/hard-to-place';
import { goBackOrReplace } from '@/lib/navigation';
import { useActiveFoster } from '@/lib/state/app-store';
import { colors, softShadow } from '@/lib/theme';

export default function HardToPlaceScreen() {
  const router = useRouter();
  const foster = useActiveFoster();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const playbook = HARD_TO_PLACE_PLAYBOOKS.find((item) => item.id === selectedId) ?? null;

  const openAction = (action: HardToPlaceAction) => {
    switch (action.destination) {
      case 'photo-coach': router.push({ pathname: '/tools/photo-coach', params: { fosterId: foster.id, goalId: action.goalId } }); return;
      case 'video-coach': router.push({ pathname: '/tools/video-coach', params: { fosterId: foster.id } }); return;
      case 'adoption-bio': router.push({ pathname: '/create/editor', params: { fosterId: foster.id, kind: 'Adoption Bio' } }); return;
      case 'profile': router.push({ pathname: '/foster/[id]', params: { id: foster.id, section: 'Progress' } }); return;
      case 'update': router.push({ pathname: '/foster/update', params: { fosterId: foster.id } }); return;
      case 'saved-content': router.push({ pathname: '/create/saved', params: { fosterId: foster.id } }); return;
      case 'marketing-activity': router.push({ pathname: '/tools/marketing-tracker', params: { fosterId: foster.id } }); return;
      case 'create': router.push({ pathname: '/create/editor', params: { fosterId: foster.id, kind: action.kind ?? 'Social Media Post', source: 'idea', context: action.context } });
    }
  };

  return (
    <Screen testID="hard-to-place-screen" edges={['top']}>
      <ScreenHeader title="Hard-to-Place Help" onBack={() => goBackOrReplace(router, '/(tabs)/more')} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 44 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(400)}>
          <Text className="font-display text-3xl leading-[40px] text-forest">When interest has stalled</Text>
          <Text className="mt-1.5 font-sans text-lg leading-[24px] text-ink-soft">Pick what feels most challenging for {foster.name}. These are practical next steps, not a judgment about your foster.</Text>
        </Animated.View>
        <Text className="mb-3 mt-7 font-display text-2xl text-forest">What seems to be the challenge?</Text>
        <ChipRow>
          {HARD_TO_PLACE_PLAYBOOKS.map((item) => <Chip key={item.id} testID={`challenge-${item.id}`} label={item.title} showCheck selected={selectedId === item.id} onPress={() => setSelectedId(selectedId === item.id ? null : item.id)} />)}
        </ChipRow>
        {playbook ? <Animated.View key={playbook.id} entering={FadeInDown.duration(360)} className="mt-6 overflow-hidden rounded-4xl bg-forest" style={softShadow}>
          <View className="p-5">
            <View className="mb-3 h-8 flex-row items-center self-start rounded-full bg-cream/15 px-3"><Lightbulb size={14} color={colors.cream} strokeWidth={2.4} /><Text className="ml-1.5 font-extrabold text-xs uppercase tracking-[1.2px] text-cream">What may help</Text></View>
            <Text className="font-display text-2xl leading-[30px] text-cream">{playbook.title}</Text>
            <Text className="mt-2.5 font-sans text-base leading-[23px] text-cream/85">{playbook.whatMayHelp}</Text>
          </View>
          <View className="bg-cream p-5">
            <View className="flex-row items-center"><ListChecks size={19} color={colors.forest} strokeWidth={2.3} /><Text className="ml-2 font-display text-xl text-forest">Try these next</Text></View>
            {playbook.nextSteps.map((step, index) => <View key={step} className="mt-3 flex-row"><View className="mr-3 h-6 w-6 items-center justify-center rounded-full bg-beige"><Text className="font-bold text-xs text-forest">{index + 1}</Text></View><Text className="flex-1 font-sans text-base leading-[21px] text-ink-soft">{step}</Text></View>)}
            <View className="mt-5 gap-2">{playbook.actions.map((action) => <Button key={action.label} testID={`hard-to-place-action-${action.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} label={action.label} variant={action.destination === 'create' ? 'primary' : 'secondary'} size="md" onPress={() => openAction(action)} />)}</View>
          </View>
        </Animated.View> : <View className="mt-6 items-center rounded-4xl border border-dashed border-hairline bg-cream-deep/60 p-6"><Text className="text-center font-sans text-base leading-[21px] text-ink-muted">Choose a challenge and we’ll connect you to useful existing Foster Famous tools.</Text></View>}
      </ScrollView>
    </Screen>
  );
}
