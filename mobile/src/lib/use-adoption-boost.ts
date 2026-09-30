import { useCallback, useEffect, useMemo } from 'react';

import { buildAdoptionBoostRecommendations } from './adoption-boost';
import { useAppStore } from './state/app-store';
import type { AdoptionBoostRecommendation, Foster } from './types';
import { useDaysInFoster } from './use-days-in-foster';

const EMPTY_DISMISSED: readonly AdoptionBoostRecommendation['category'][] = [];

function sameReasons(
  first: readonly string[],
  second: readonly string[]
): boolean {
  return first.length === second.length && first.every((reason, index) => reason === second[index]);
}

export function useAdoptionBoost(foster: Foster) {
  const daysInFoster = useDaysInFoster(foster);
  const mediaItems = useAppStore((state) => state.mediaItems);
  const coachGoals = useAppStore((state) => state.coachGoals);
  const contentPosts = useAppStore((state) => state.contentPosts);
  const publicationRecords = useAppStore((state) => state.publicationRecords);
  const recommendations = useAppStore((state) => state.adoptionBoostRecommendations);
  const dismissedByFoster = useAppStore((state) => state.dismissedBoostCategories);
  const dismissedCategories = dismissedByFoster[foster.id] ?? EMPTY_DISMISSED;
  const saveRecommendation = useAppStore((state) => state.saveAdoptionBoostRecommendation);
  const dismissCategory = useAppStore((state) => state.dismissAdoptionBoostCategory);

  const possibleRecommendations = useMemo(
    () =>
      buildAdoptionBoostRecommendations({
        foster,
        // A missing intake date should not be displayed as day zero; use zero only
        // internally so date-based boost thresholds stay inactive until it is set.
        daysInFoster: daysInFoster ?? 0,
        mediaItems,
        coachGoals,
        contentPosts,
        publicationRecords,
        dismissedCategories,
      }),
    [coachGoals, contentPosts, daysInFoster, dismissedCategories, foster, mediaItems, publicationRecords]
  );

  const newestStored = useMemo(
    () =>
      recommendations
        .filter((item) => item.petId === foster.id)
        .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))[0],
    [foster.id, recommendations]
  );
  const matchingCurrent = possibleRecommendations.find(
    (item) => item.category === newestStored?.category && item.dateKey === newestStored.dateKey
  );
  const recommendation =
    newestStored && matchingCurrent && sameReasons(newestStored.sourceReason, matchingCurrent.sourceReason)
      ? newestStored
      : possibleRecommendations[0];

  useEffect(() => {
    if (
      foster.isDemo ||
      foster.adoptionStatus === 'Adopted' ||
      !recommendation ||
      (newestStored?.id === recommendation.id && sameReasons(newestStored.sourceReason, recommendation.sourceReason))
    ) {
      return;
    }
    saveRecommendation(recommendation);
  }, [foster.adoptionStatus, foster.isDemo, newestStored, recommendation, saveRecommendation]);

  const chooseAnother = useCallback(() => {
    if (!recommendation) return;
    const index = possibleRecommendations.findIndex(
      (item) => item.category === recommendation.category
    );
    const next = possibleRecommendations[(index + 1) % possibleRecommendations.length];
    if (next && next.category !== recommendation.category) saveRecommendation(next);
  }, [possibleRecommendations, recommendation, saveRecommendation]);

  const dismiss = useCallback(
    (permanently: boolean) => {
      if (!recommendation) return;
      if (permanently) dismissCategory(foster.id, recommendation.category);
      else chooseAnother();
    },
    [chooseAnother, dismissCategory, foster.id, recommendation]
  );

  return {
    recommendation: foster.adoptionStatus === 'Adopted' ? null : recommendation,
    possibleRecommendations,
    daysInFoster,
    chooseAnother,
    dismiss,
  } as const;
}

export function recommendationHistory(
  recommendations: readonly AdoptionBoostRecommendation[],
  fosterId: string
): readonly AdoptionBoostRecommendation[] {
  return recommendations
    .filter((recommendation) => recommendation.petId === fosterId)
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
}
