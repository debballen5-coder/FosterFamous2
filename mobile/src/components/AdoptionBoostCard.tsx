import { useRouter } from 'expo-router';
import { ChevronRight, Lightbulb, PawPrint, RefreshCw } from 'lucide-react-native';
import React, { useState } from 'react';
import { Modal, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/Pressables';
import { colors, liftedShadow, softShadow } from '@/lib/theme';
import { useAdoptionBoost } from '@/lib/use-adoption-boost';
import { useAppStore } from '@/lib/state/app-store';
import type { AdoptionBoostRecommendation, Foster } from '@/lib/types';

type Props = {
  foster: Foster;
  compact?: boolean;
};

function postKind(recommendation: AdoptionBoostRecommendation): string {
  switch (recommendation.category) {
    case 'create-adoption-bio':
    case 'refresh-adoption-bio':
      return 'Adoption Bio';
    case 'local-community-post':
      return 'Local Community Post';
    case 'please-share-post':
      return 'Please Share Post';
    case 'progress-post':
      return 'Progress Update';
    case 'funny-post':
      return 'Funny Post';
    case 'ideal-home-post':
      return 'Petfinder / Rescue Listing';
    default:
      return 'Social Media Post';
  }
}

export function AdoptionBoostCard({ foster, compact = false }: Props) {
  const router = useRouter();
  const { recommendation, daysInFoster, chooseAnother, dismiss } = useAdoptionBoost(foster);
  const startCampaign = useAppStore((state) => state.startAdoptionBoostCampaign);
  const [whyOpen, setWhyOpen] = useState<boolean>(false);

  if (foster.adoptionStatus === 'Adopted') {
    return (
      <View testID="adoption-boost-adopted" className="overflow-hidden rounded-4xl bg-forest p-5" style={liftedShadow}>
        <Text className="font-display text-2xl text-cream">{foster.name} is adopted! 🎉</Text>
        <Text className="mt-1.5 font-sans text-base leading-[22px] text-cream/80">Marketing reminders are paused. What a wonderful next chapter.</Text>
        <Button testID="adoption-boost-success-story" label="View Adopted / Archived" variant="accent" size="md" className="mt-4" onPress={() => router.push('/(tabs)/fosters')} />
      </View>
    );
  }

  if (!recommendation) return null;

  const act = () => {
    switch (recommendation.destination) {
      case 'profile-photo':
        router.push({ pathname: '/foster/[id]', params: { id: foster.id, action: 'profile-photo' } });
        return;
      case 'profile-personality':
        router.push({ pathname: '/foster/wizard', params: { id: foster.id, step: '2' } });
        return;
      case 'profile-adoption':
        router.push({ pathname: '/foster/wizard', params: { id: foster.id, step: '5' } });
        return;
      case 'adoption-bio':
        router.push({ pathname: '/create/editor', params: { fosterId: foster.id, kind: 'Adoption Bio' } });
        return;
      case 'photo-coach':
        router.push({ pathname: '/tools/photo-coach', params: { fosterId: foster.id, ...recommendation.destinationParams } });
        return;
      case 'video-coach':
        router.push({ pathname: '/tools/video-coach', params: { fosterId: foster.id } });
        return;
      case 'campaign': {
        startCampaign(foster.id);
        router.push({ pathname: '/adoption-boost', params: { fosterId: foster.id } });
        return;
      }
      case 'post-builder':
        router.push({
          pathname: '/create/editor',
          params: { fosterId: foster.id, kind: postKind(recommendation), source: 'idea', ...recommendation.destinationParams },
        });
        return;
      default:
        return;
    }
  };

  return (
    <View testID="adoption-boost-card" className={compact ? 'overflow-hidden rounded-4xl bg-forest p-5' : 'overflow-hidden rounded-5xl bg-forest p-6'} style={liftedShadow}>
      <View className="flex-row items-center self-start rounded-full bg-cream/15 px-3 py-1.5">
        <PawPrint size={14} color={colors.cream} strokeWidth={2.6} />
        <Text className="ml-1.5 font-extrabold text-xs uppercase tracking-[1.3px] text-cream">Adoption Boost</Text>
      </View>
      <Text className="mt-4 font-sans text-sm text-cream/70">
        {daysInFoster === null
          ? 'Add a foster start date to track time in care.'
          : `${foster.name} has been in foster for ${daysInFoster} day${daysInFoster === 1 ? '' : 's'}`}
      </Text>
      <Text className="mt-2 font-display text-2xl leading-[31px] text-cream">{recommendation.title}</Text>
      <Text className="mt-2 font-sans text-base leading-[23px] text-cream">{recommendation.explanation}</Text>
      <View className="mt-5">
        <Button testID="adoption-boost-do-this" label={recommendation.suggestedAction} variant="accent" onPress={act} />
      </View>
      <View className="mt-3 flex-row items-center justify-between">
        <PressableScale testID="adoption-boost-why" accessibilityRole="button" onPress={() => setWhyOpen(true)} className="h-10 flex-row items-center">
          <Lightbulb size={16} color={colors.cream} strokeWidth={2.4} />
          <Text className="ml-1.5 font-bold text-sm text-cream underline">Why this?</Text>
        </PressableScale>
        <PressableScale testID="adoption-boost-another" accessibilityRole="button" onPress={chooseAnother} className="h-10 flex-row items-center">
          <RefreshCw size={15} color={colors.cream} strokeWidth={2.4} />
          <Text className="ml-1.5 font-bold text-sm text-cream underline">Another Idea</Text>
        </PressableScale>
      </View>
      {!compact ? (
        <PressableScale testID="adoption-boost-not-now" accessibilityRole="button" onPress={() => dismiss(false)} className="mt-1 h-9 items-center justify-center">
          <Text className="font-semibold text-sm text-cream/70">Not right now</Text>
        </PressableScale>
      ) : null}

      <Modal visible={whyOpen} transparent animationType="fade" onRequestClose={() => setWhyOpen(false)}>
        <View className="flex-1 justify-end bg-forest-deep/55 px-4 pb-5">
          <View testID="adoption-boost-why-sheet" className="rounded-[32px] bg-cream p-5" style={softShadow}>
            <View className="mb-4 h-1.5 w-12 self-center rounded-full bg-beige-dark" />
            <Text className="font-display text-2xl text-forest">Why this?</Text>
            <Text className="mt-2 font-sans text-base leading-[23px] text-ink-soft">{recommendation.explanation}</Text>
            <Text className="mb-2 mt-5 font-extrabold text-xs uppercase tracking-[1px] text-ink-muted">What Foster Famous used</Text>
            {recommendation.sourceReason.map((reason) => <Text key={reason} className="mt-1 font-sans text-sm leading-[20px] text-ink-soft">• {reason}</Text>)}
            <Button testID="adoption-boost-dismiss-category" label="Don't Suggest This Again" variant="outline" size="md" className="mt-5" onPress={() => { dismiss(true); setWhyOpen(false); }} />
            <Button testID="adoption-boost-close-why" label="Close" variant="ghost" size="md" className="mt-2" icon={<ChevronRight size={16} color={colors.forest} />} onPress={() => setWhyOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
