import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEMO_FOSTERS, DEMO_PLAN } from '../demo-data';
import {
  migrationPlanFromLegacy,
  movePlanTask,
  restartPlan,
  updatePlanTask,
  type FosterPlanState,
  type FosterPlanTaskStatus,
} from '../foster-plan';
import {
  applyFosterLifecycle,
  canReactivateAfterAdoption,
  currentFosterPeriod,
  ensureAdoptionEvents,
  ensureFosterPeriods,
  isActiveFoster,
} from '../foster-lifecycle';
import { isFutureFosterDate, normalizeFosterDate, normalizePersistedFosterDate } from '../foster-date';
import { contentPostMediaIds, normalizeContentPostMedia } from '../content-post-media';
import {
  createDurableMediaCopies,
  deleteRemoteMediaCopies,
  MediaUploadError,
  deleteStoredMediaFiles,
  isBrokenMediaUri,
  mediaUri,
  storePickedMedia,
  type StorePickedMediaOptions,
} from '../media-storage';
import { PHOTO_COACH_GOALS, VIDEO_COACH_GOALS } from '../options';
import { BOOST_TASKS } from '../adoption-boost';
import { ADOPTION_STATUSES } from '../types';
import type { SharePlatform } from '../share-content';
import type {
  AdoptionBoostCampaign,
  AdoptionBoostCategory,
  AdoptionBoostRecommendation,
  AdoptionBoostTask,
  AdoptionBoostTaskStatus,
  AdoptionStatus,
  CoachGoalRecord,
  CoachMediaType,
  ContentCreationMode,
  ContentPost,
  ContentPostStatus,
  Foster,
  FosterPreference,
  MarketingActivity,
  MediaCategoryTag,
  MediaItem,
  PlanDay,
  PublicationRecord,
  ProgressUpdateCategory,
} from '../types';

type PlanStatus = PlanDay['status'];

type ManualMarketingActivityInput = {
  petId: string;
  platform: string;
  contentType: string;
  summary: string;
  occurredAt?: string;
  outcomes?: {
    inquiryReceived: boolean;
    applicationReceived: boolean;
    meetAndGreetInterest: boolean;
    notes: string;
  };
};

export interface DefaultRescueInformation {
  rescueName: string;
  contactName: string;
  adoptionWebsite: string;
  adoptionEmail: string;
  phone: string;
  instructions: string;
}

export const EMPTY_RESCUE_INFORMATION: DefaultRescueInformation = {
  rescueName: '',
  contactName: '',
  adoptionWebsite: '',
  adoptionEmail: '',
  phone: '',
  instructions: '',
};

// v16 also removes any legacy draft attachment that belongs to a different foster.
const STORE_VERSION = 16;
const DEMO_PHOTOS_CAPTURED = [
  'Face close-up',
  'Full body',
  'Eye-level portrait',
  'Playing',
  'Sleeping',
  'Favorite toy',
  'Outdoors',
  'Funny expression',
  'Profile photo',
];
const DEMO_VIDEOS_CAPTURED = ['Play clip', 'Favorite toy', 'Funny habit'];

function createContentPostId(sourceId: string): string {
  return `${sourceId}-copy-${Date.now()}`;
}

function mediaMatchesUri(media: MediaItem, uri: string): boolean {
  return (
    media.localUri === uri ||
    media.thumbnailUri === uri ||
    media.remoteUri === uri ||
    media.remoteThumbnailUri === uri ||
    media.metadata.originalUri === uri
  );
}

/** Older records can retain a usable picker URI after their app-local copy is gone. */
async function availableMediaSourceUri(media: MediaItem): Promise<string | null> {
  const candidates = [media.localUri, media.metadata.originalUri];
  for (const uri of candidates) {
    if (uri && !(await isBrokenMediaUri(uri))) return uri;
  }
  return null;
}

function findMediaForAsset(
  mediaItems: readonly MediaItem[],
  fosterId: string,
  type: MediaItem['type'],
  asset: StorePickedMediaOptions['assets'][number]
): MediaItem | undefined {
  return mediaItems.find(
    (media) =>
      media.fosterId === fosterId &&
      media.type === type &&
      !media.deletedAt &&
      (mediaMatchesUri(media, asset.uri) ||
        (Boolean(asset.assetId) && media.metadata.assetId === asset.assetId))
  );
}

const mediaAssetSaves = new Map<string, Promise<MediaItem>>();
const profileMediaImports = new Map<string, Promise<boolean>>();
const contentMediaImports = new Map<string, Promise<boolean>>();

function coachOptions(mediaType: CoachMediaType) {
  return mediaType === 'photo' ? PHOTO_COACH_GOALS : VIDEO_COACH_GOALS;
}

function goalIdForLabel(mediaType: CoachMediaType, label: string): string | undefined {
  return coachOptions(mediaType).find((goal) => goal.label === label)?.id;
}

function isGoalComplete(goal: CoachGoalRecord | undefined): boolean {
  return Boolean(goal && (goal.manuallyCompleted || goal.mediaIds.length > 0));
}

function completedLabels(
  coachGoals: readonly CoachGoalRecord[],
  fosterId: string,
  mediaType: CoachMediaType
): string[] {
  return coachOptions(mediaType)
    .filter((option) =>
      isGoalComplete(
        coachGoals.find(
          (goal) =>
            goal.fosterId === fosterId &&
            goal.mediaType === mediaType &&
            goal.goalId === option.id
        )
      )
    )
    .map((option) => option.label);
}

function normalizeOwnedContentPostMedia(
  post: ContentPost,
  mediaItems: readonly MediaItem[]
): ContentPost {
  const requestedMediaIds = contentPostMediaIds(post);
  const mediaIds = requestedMediaIds.filter((id) => {
    const media = mediaItems.find((candidate) => candidate.id === id);
    // A missing legacy asset remains unavailable rather than being rewritten here;
    // only a known asset owned by another foster is an invalid relationship.
    return !media || media.fosterId === post.petId;
  });
  const normalized = normalizeContentPostMedia(mediaIds);
  const removedForeignMedia = mediaIds.length !== requestedMediaIds.length;
  // URI-only drafts predate media IDs. A URI that is already registered to a
  // different foster cannot be imported into this post during reconciliation.
  const sourceBelongsToAnotherFoster = Boolean(
    post.sourceUri && mediaItems.some(
      (media) => media.fosterId !== post.petId && mediaMatchesUri(media, post.sourceUri!)
    )
  );
  const primaryMedia = normalized.primaryMediaId
    ? mediaItems.find((media) => media.id === normalized.primaryMediaId)
    : undefined;

  return {
    ...post,
    ...normalized,
    sourceUri:
      removedForeignMedia
        ? (primaryMedia ? mediaUri(primaryMedia) : null)
        : sourceBelongsToAnotherFoster
          ? null
          : post.sourceUri,
  };
}

function currentFactsSignature(foster: Foster): string {
  return JSON.stringify({
    name: foster.name,
    species: foster.species,
    sex: foster.sex,
    age: foster.age,
    breed: foster.breed,
    weight: foster.weight,
    size: foster.size,
    fosterStartDate: foster.fosterStartDate,
    fosterPeriods: foster.fosterPeriods,
    adoptionEvents: foster.adoptionEvents,
    personality: foster.personality,
    personalityNotes: foster.personalityNotes,
    goodWithDogs: foster.goodWithDogs,
    goodWithCats: foster.goodWithCats,
    goodWithChildren: foster.goodWithChildren,
    childrenNotes: foster.childrenNotes,
    houseTrained: foster.houseTrained,
    crateTrained: foster.crateTrained,
    energyLevel: foster.energyLevel,
    special: foster.special,
    rescueName: foster.rescueName,
    city: foster.city,
    state: foster.state,
    adoptionUrl: foster.adoptionUrl,
    contactMethod: foster.contactMethod,
    adoptionFee: foster.adoptionFee,
    adoptionStatus: foster.adoptionStatus,
    considerations: foster.considerations,
    currentStatus: foster.currentStatus ?? '',
  });
}

function legacyCoachLists(
  coachGoals: readonly CoachGoalRecord[],
  fosters: readonly Foster[],
  activeFosterId: string | null
): Pick<AppState, 'photosCaptured' | 'videosCaptured'> {
  const foster = fosters.find((candidate) => candidate.id === activeFosterId);
  if (!foster) {
    return {
      photosCaptured: [...DEMO_PHOTOS_CAPTURED],
      videosCaptured: [...DEMO_VIDEOS_CAPTURED],
    };
  }

  return {
    photosCaptured: completedLabels(coachGoals, foster.id, 'photo'),
    videosCaptured: completedLabels(coachGoals, foster.id, 'video'),
  };
}

function upsertCoachGoal(
  coachGoals: readonly CoachGoalRecord[],
  fosterId: string,
  mediaType: CoachMediaType,
  goalId: string,
  update: (current: CoachGoalRecord) => CoachGoalRecord
): CoachGoalRecord[] {
  const index = coachGoals.findIndex(
    (goal) =>
      goal.fosterId === fosterId && goal.mediaType === mediaType && goal.goalId === goalId
  );
  const current: CoachGoalRecord =
    index >= 0
      ? coachGoals[index]
      : {
          fosterId,
          mediaType,
          goalId,
          manuallyCompleted: false,
          mediaIds: [],
          updatedAt: new Date().toISOString(),
        };
  const next = update(current);
  return index >= 0
    ? coachGoals.map((goal, goalIndex) => (goalIndex === index ? next : goal))
    : [...coachGoals, next];
}

interface AppState {
  hydrated: boolean;

  // Onboarding
  onboardingComplete: boolean;
  fosterPreference: FosterPreference | null;
  helpTopics: string[];
  defaultRescueInformation: DefaultRescueInformation;

  /** User-created fosters only. Demo fosters are never persisted here. */
  fosters: Foster[];
  activeFosterId: string | null;

  /** Retained only to migrate old installations; real plan state is foster-scoped. */
  planStatus: Record<number, PlanStatus>;
  fosterPlans: Record<string, FosterPlanState>;
  /** Legacy active-foster projections retained until coach screens use records directly. */
  photosCaptured: string[];
  videosCaptured: string[];

  contentPosts: ContentPost[];
  /** User-confirmed platform posts; opening a share sheet never creates these. */
  publicationRecords: PublicationRecord[];
  marketingActivities: MarketingActivity[];
  mediaItems: MediaItem[];
  coachGoals: CoachGoalRecord[];
  /** Persisted daily recommendation snapshots, scoped to each foster. */
  adoptionBoostRecommendations: AdoptionBoostRecommendation[];
  dismissedBoostCategories: Record<string, AdoptionBoostCategory[]>;
  adoptionBoostCampaigns: AdoptionBoostCampaign[];
  adoptionBoostTasks: AdoptionBoostTask[];

  setFosterPreference: (pref: FosterPreference) => void;
  setDefaultRescueInformation: (information: DefaultRescueInformation) => void;
  toggleHelpTopic: (topic: string) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;

  addFoster: (foster: Foster) => void;
  updateFoster: (id: string, changes: Partial<Foster>) => void;
  /** Starts a new active foster period after a user-confirmed return without losing history. */
  reactivateFoster: (id: string, returnedAt?: string) => boolean;
  saveFosterProgressUpdate: (
    fosterId: string,
    input: {
      currentStatus: string;
      summary: string;
      category: ProgressUpdateCategory;
      adoptionStatus?: AdoptionStatus;
      adoptionDate?: string;
    }
  ) => boolean;
  saveFosterWithProfileMedia: (
    foster: Foster,
    photoAsset?: StorePickedMediaOptions['assets'][number] | null
  ) => Promise<Foster>;
  setActiveFoster: (id: string) => void;

  setPlanStatus: (day: number, status: PlanStatus) => void;
  setFosterPlanTaskStatus: (
    fosterId: string,
    day: number,
    status: FosterPlanTaskStatus,
    linkedContentPostId?: string | null
  ) => void;
  moveFosterPlanTask: (fosterId: string, day: number, targetScheduledDay: number) => void;
  restartFosterPlan: (fosterId: string) => void;
  togglePhoto: (label: string) => void;
  toggleVideo: (label: string) => void;

  saveContentPost: (post: ContentPost) => void;
  updateContentPost: (id: string, changes: Partial<ContentPost>) => void;
  deleteContentPost: (id: string) => void;
  duplicateContentPost: (id: string) => void;
  setContentPostStatus: (id: string, status: ContentPostStatus) => void;
  recordPublication: (
    contentPostId: string,
    platforms: readonly SharePlatform[],
    notes?: string | null
  ) => PublicationRecord[];
  addManualMarketingActivity: (input: ManualMarketingActivityInput) => void;

  addMediaItem: (media: MediaItem) => boolean;
  addMediaItems: (media: readonly MediaItem[]) => number;
  saveMediaAssets: (options: StorePickedMediaOptions) => Promise<MediaItem[]>;
  ensureDurableMediaCopies: () => Promise<boolean>;
  ensureFosterProfileMedia: (fosterId: string) => Promise<boolean>;
  ensureContentPostMedia: (postId: string) => Promise<boolean>;
  updateMediaItem: (id: string, changes: Partial<MediaItem>) => void;
  updateMediaDetails: (
    id: string,
    changes: { title?: string; notes?: string; tags?: readonly MediaCategoryTag[] }
  ) => void;
  setMediaFavorite: (id: string, favorite: boolean) => void;
  toggleMediaFavorite: (id: string) => void;
  deleteMediaItem: (id: string) => Promise<boolean>;
  setFosterProfilePhotoFromMedia: (fosterId: string, mediaId: string) => boolean;
  setFosterSuccessStoryPhoto: (fosterId: string, mediaId: string | null) => boolean;

  attachMediaToCoachGoal: (
    fosterId: string,
    mediaType: CoachMediaType,
    goalId: string,
    mediaId: string
  ) => boolean;
  detachMediaFromCoachGoal: (
    fosterId: string,
    mediaType: CoachMediaType,
    goalId: string,
    mediaId: string
  ) => void;
  setCoachGoalManualCompletion: (
    fosterId: string,
    mediaType: CoachMediaType,
    goalId: string,
    completed: boolean
  ) => void;

  saveAdoptionBoostRecommendation: (recommendation: AdoptionBoostRecommendation) => void;
  dismissAdoptionBoostCategory: (fosterId: string, category: AdoptionBoostCategory) => void;
  startAdoptionBoostCampaign: (fosterId: string) => AdoptionBoostCampaign | null;
  updateAdoptionBoostTask: (
    campaignId: string,
    taskId: string,
    status: AdoptionBoostTaskStatus,
    linkedContentPostId?: string | null
  ) => void;
  replaceAdoptionBoostTask: (campaignId: string, taskId: string) => AdoptionBoostTask | null;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      hydrated: false,

      onboardingComplete: false,
      fosterPreference: null,
      helpTopics: [],
      defaultRescueInformation: { ...EMPTY_RESCUE_INFORMATION },

      fosters: [],
      activeFosterId: null,

      planStatus: Object.fromEntries(DEMO_PLAN.map((day) => [day.day, day.status])) as Record<
        number,
        PlanStatus
      >,
      fosterPlans: {},
      photosCaptured: [...DEMO_PHOTOS_CAPTURED],
      videosCaptured: [...DEMO_VIDEOS_CAPTURED],

      contentPosts: [],
      publicationRecords: [],
      marketingActivities: [],
      mediaItems: [],
      coachGoals: [],
      adoptionBoostRecommendations: [],
      dismissedBoostCategories: {},
      adoptionBoostCampaigns: [],
      adoptionBoostTasks: [],

      setFosterPreference: (pref) => set({ fosterPreference: pref }),
      setDefaultRescueInformation: (information) =>
        set({ defaultRescueInformation: { ...EMPTY_RESCUE_INFORMATION, ...information } }),

      toggleHelpTopic: (topic) => {
        const current = get().helpTopics;
        set({
          helpTopics: current.includes(topic)
            ? current.filter((candidate) => candidate !== topic)
            : [...current, topic],
        });
      },

      completeOnboarding: () => set({ onboardingComplete: true }),
      resetOnboarding: () =>
        set({ onboardingComplete: false, fosterPreference: null, helpTopics: [] }),

      addFoster: (foster) => {
        if (foster.isDemo) return;
        const savedFoster = applyFosterLifecycle(undefined, foster);
        const state = get();
        const fosters = [
          ...state.fosters.filter((candidate) => candidate.id !== savedFoster.id),
          savedFoster,
        ];
        const activeFosterId = isActiveFoster(savedFoster)
          ? savedFoster.id
          : state.activeFosterId;
        set({
          fosters,
          activeFosterId,
          ...legacyCoachLists(state.coachGoals, fosters, activeFosterId),
        });
      },

      updateFoster: (id, changes) => {
        const state = get();
        const current = state.fosters.find((foster) => foster.id === id);
        if (!current || current.isDemo) return;
        const now = new Date().toISOString();
        const candidate = { ...current, ...changes, id, isDemo: false };
        const next = applyFosterLifecycle(current, candidate, now);
        const factualChange = currentFactsSignature(current) !== currentFactsSignature(next);
        const adopted = next.adoptionStatus === 'Adopted';
        const reactivated = current.adoptionStatus === 'Adopted' && !adopted;
        const fosters = state.fosters.map((foster) =>
          foster.id === id
            ? { ...next, currentInfoUpdatedAt: factualChange ? now : current.currentInfoUpdatedAt }
            : foster
        );
        const nextActiveId =
          state.activeFosterId === id && adopted
            ? fosters.find(isActiveFoster)?.id ?? null
            : reactivated
              ? id
              : state.activeFosterId;
        set({
          fosters,
          activeFosterId: nextActiveId,
          adoptionBoostRecommendations: factualChange || adopted
            ? state.adoptionBoostRecommendations.filter((item) => item.petId !== id)
            : state.adoptionBoostRecommendations,
          adoptionBoostCampaigns: adopted
            ? state.adoptionBoostCampaigns.map((campaign) =>
                campaign.petId === id && campaign.status === 'Active'
                  ? { ...campaign, status: 'Completed', completedAt: now, updatedAt: now }
                  : campaign
              )
            : state.adoptionBoostCampaigns,
          ...legacyCoachLists(state.coachGoals, fosters, nextActiveId),
        });
      },

      reactivateFoster: (id, returnedAt) => {
        const state = get();
        const current = state.fosters.find((foster) => foster.id === id);
        if (!current || current.isDemo || current.adoptionStatus !== 'Adopted') return false;
        if (!returnedAt || !canReactivateAfterAdoption(current, returnedAt)) return false;
        const now = new Date().toISOString();
        const reactivated = applyFosterLifecycle(
          current,
          { ...current, adoptionStatus: 'Available', id, isDemo: false },
          now,
          returnedAt
        );
        const fosters = state.fosters.map((foster) =>
          foster.id === id
            ? { ...reactivated, currentInfoUpdatedAt: now }
            : foster
        );
        set({
          fosters,
          activeFosterId: id,
          adoptionBoostRecommendations: state.adoptionBoostRecommendations.filter(
            (item) => item.petId !== id
          ),
          ...legacyCoachLists(state.coachGoals, fosters, id),
        });
        return true;
      },

      saveFosterProgressUpdate: (fosterId, input) => {
        const state = get();
        const foster = state.fosters.find((candidate) => candidate.id === fosterId);
        if (!foster || foster.isDemo || foster.adoptionStatus === 'Adopted') return false;

        const currentStatus = input.currentStatus.trim();
        const summary = input.summary.trim();
        const nextPlacement = input.adoptionStatus ?? foster.adoptionStatus;
        const summaryChanged = currentStatus !== (foster.currentStatus ?? '').trim();
        const placementChanged = nextPlacement !== foster.adoptionStatus;
        if (!summaryChanged && !summary && !placementChanged) return false;

        const isNewAdoption = nextPlacement === 'Adopted';
        const adoptionDate = isNewAdoption
          ? normalizeFosterDate(input.adoptionDate) ?? undefined
          : undefined;
        if (
          isNewAdoption &&
          (!adoptionDate || isFutureFosterDate(adoptionDate))
        ) {
          return false;
        }
        const now = new Date().toISOString();
        const lifecycleFoster = applyFosterLifecycle(
          foster,
          { ...foster, adoptionStatus: nextPlacement },
          now,
          adoptionDate
        );
        // This action is the only active-to-adopted save path. A successful
        // result must include both the status and its completed foster period.
        if (
          isNewAdoption &&
          (lifecycleFoster.adoptionStatus !== 'Adopted' ||
            currentFosterPeriod(lifecycleFoster)?.endedAt !== adoptionDate)
        ) {
          return false;
        }
        const updatedFoster: Foster = {
          ...lifecycleFoster,
          currentStatus: currentStatus || undefined,
          progressUpdates: summary
            ? [
                ...(foster.progressUpdates ?? []),
                {
                  id: `progress-${fosterId}-${Date.now()}`,
                  fosterId,
                  category: placementChanged ? 'Adoption Status' : input.category,
                  summary,
                  occurredAt: now,
                  createdAt: now,
                },
              ]
            : foster.progressUpdates,
          currentInfoUpdatedAt: now,
        };
        const fosters = state.fosters.map((candidate) =>
          candidate.id === fosterId ? updatedFoster : candidate
        );
        const adopted = updatedFoster.adoptionStatus === 'Adopted';
        const activeFosterId = adopted && state.activeFosterId === fosterId
          ? fosters.find(isActiveFoster)?.id ?? null
          : state.activeFosterId;

        set({
          fosters,
          activeFosterId,
          adoptionBoostRecommendations: state.adoptionBoostRecommendations.filter(
            (item) => item.petId !== fosterId
          ),
          adoptionBoostCampaigns: adopted
            ? state.adoptionBoostCampaigns.map((campaign) =>
                campaign.petId === fosterId && campaign.status === 'Active'
                  ? { ...campaign, status: 'Completed', completedAt: now, updatedAt: now }
                  : campaign
              )
            : state.adoptionBoostCampaigns,
          ...legacyCoachLists(state.coachGoals, fosters, activeFosterId),
        });
        return true;
      },

      saveFosterWithProfileMedia: async (foster, photoAsset) => {
        if (foster.isDemo) throw new Error('Sample fosters cannot be saved.');

        let stagedMedia: MediaItem | undefined;
        let brokenProfileMediaId: string | undefined;
        const photoUri = foster.photoUri;
        const currentState = get();
        let profileMedia = photoUri
          ? photoAsset
            ? findMediaForAsset(currentState.mediaItems, foster.id, 'photo', photoAsset)
            : currentState.mediaItems.find(
                (media) =>
                  media.fosterId === foster.id &&
                  media.type === 'photo' &&
                  !media.deletedAt &&
                  mediaMatchesUri(media, photoUri)
              )
          : undefined;
        if (profileMedia && (await isBrokenMediaUri(mediaUri(profileMedia)))) {
          brokenProfileMediaId = profileMedia.id;
          profileMedia = undefined;
        }

        if (photoUri && !profileMedia) {
          const brokenProfileMedia = brokenProfileMediaId
            ? currentState.mediaItems.find((item) => item.id === brokenProfileMediaId)
            : undefined;
          const asset = photoAsset ?? {
            uri: brokenProfileMedia?.metadata.originalUri ?? photoUri,
            width: 0,
            height: 0,
            type: 'image' as const,
            fileName: brokenProfileMedia?.metadata.fileName ?? null,
            assetId: brokenProfileMedia?.metadata.assetId ?? null,
            mimeType: brokenProfileMedia?.metadata.mimeType ?? undefined,
          };
          [stagedMedia] = await storePickedMedia({
            fosterId: foster.id,
            type: 'photo',
            assets: [asset],
            source: 'profile',
            tags: ['profile'],
          });
          if (!stagedMedia) {
            throw new Error('The profile photo could not be stored.');
          }
          profileMedia = stagedMedia;
        }

        let unusedStagedMedia: MediaItem | undefined;
        let savedFoster = foster;
        set((state) => {
          const wasExisting = state.fosters.some((candidate) => candidate.id === foster.id);
          const availableMedia = brokenProfileMediaId
            ? state.mediaItems.filter((item) => item.id !== brokenProfileMediaId)
            : state.mediaItems;
          const matchingAtCommit = photoUri
            ? photoAsset
              ? findMediaForAsset(availableMedia, foster.id, 'photo', photoAsset)
              : availableMedia.find(
                  (media) =>
                    media.fosterId === foster.id &&
                    media.type === 'photo' &&
                    !media.deletedAt &&
                    mediaMatchesUri(media, photoUri)
                )
            : undefined;
          const selectedMedia = matchingAtCommit ?? profileMedia;
          if (stagedMedia && selectedMedia?.id !== stagedMedia.id) {
            unusedStagedMedia = stagedMedia;
          }

          const durablePhotoUri = selectedMedia ? mediaUri(selectedMedia, true) : null;
          const existing = state.fosters.find((candidate) => candidate.id === foster.id);
          const nextFoster = { ...foster, photoUri: durablePhotoUri };
          const now = new Date().toISOString();
          const lifecycleFoster = applyFosterLifecycle(existing, nextFoster, now);
          const factualChange = !existing || currentFactsSignature(existing) !== currentFactsSignature(lifecycleFoster);
          savedFoster = {
            ...lifecycleFoster,
            // Creating the profile is not activity; record this only for later factual edits.
            currentInfoUpdatedAt: existing && factualChange ? now : existing?.currentInfoUpdatedAt,
          };
          const fosters = wasExisting
            ? state.fosters.map((candidate) =>
                candidate.id === foster.id ? savedFoster : candidate
              )
            : [...state.fosters, savedFoster];
          const mediaItems = [
            ...state.mediaItems,
            ...(stagedMedia &&
            selectedMedia?.id === stagedMedia.id &&
            !state.mediaItems.some((item) => item.id === stagedMedia?.id)
              ? [stagedMedia]
              : []),
          ].map((item) => {
            if (item.id === brokenProfileMediaId) {
              return { ...item, deletedAt: now, updatedAt: now };
            }
            if (item.fosterId !== foster.id || item.type !== 'photo') return item;
            const tags: MediaCategoryTag[] = item.tags.filter((tag) => tag !== 'profile');
            if (item.id === selectedMedia?.id) tags.push('profile');
            return tags.length === item.tags.length &&
              tags.every((tag, index) => tag === item.tags[index])
              ? item
              : { ...item, tags, updatedAt: now };
          });
          const reactivated =
            existing?.adoptionStatus === 'Adopted' && savedFoster.adoptionStatus !== 'Adopted';
          const activeFosterId =
            savedFoster.adoptionStatus === 'Adopted' && state.activeFosterId === foster.id
              ? fosters.find(isActiveFoster)?.id ?? null
              : reactivated
                ? foster.id
                : wasExisting
                  ? state.activeFosterId
                  : foster.id;

          return {
            fosters,
            mediaItems,
            activeFosterId,
            adoptionBoostRecommendations: factualChange || savedFoster.adoptionStatus === 'Adopted'
              ? state.adoptionBoostRecommendations.filter((item) => item.petId !== foster.id)
              : state.adoptionBoostRecommendations,
            adoptionBoostCampaigns: savedFoster.adoptionStatus === 'Adopted'
              ? state.adoptionBoostCampaigns.map((campaign) =>
                  campaign.petId === foster.id && campaign.status === 'Active'
                    ? { ...campaign, status: 'Completed', completedAt: now, updatedAt: now }
                    : campaign
                )
              : state.adoptionBoostCampaigns,
            ...legacyCoachLists(state.coachGoals, fosters, activeFosterId),
          };
        });

        if (unusedStagedMedia) {
          await deleteRemoteMediaCopies(unusedStagedMedia).catch(() => undefined);
          await deleteStoredMediaFiles(unusedStagedMedia);
        }
        return savedFoster;
      },

      setActiveFoster: (id) => {
        const state = get();
        const foster = state.fosters.find((candidate) => candidate.id === id);
        if (!foster || !isActiveFoster(foster)) return;
        set({ activeFosterId: id, ...legacyCoachLists(state.coachGoals, state.fosters, id) });
      },

      setPlanStatus: (day, status) => set({ planStatus: { ...get().planStatus, [day]: status } }),

      setFosterPlanTaskStatus: (fosterId, day, status, linkedContentPostId = null) => {
        const state = get();
        const foster = state.fosters.find((candidate) => candidate.id === fosterId);
        if (!foster || foster.isDemo || foster.adoptionStatus === 'Adopted') return;
        set({
          fosterPlans: {
            ...state.fosterPlans,
            [fosterId]: updatePlanTask(state.fosterPlans[fosterId], day, status, undefined, linkedContentPostId),
          },
        });
      },

      moveFosterPlanTask: (fosterId, day, targetScheduledDay) => {
        const state = get();
        const foster = state.fosters.find((candidate) => candidate.id === fosterId);
        if (!foster || foster.isDemo || foster.adoptionStatus === 'Adopted') return;
        set({
          fosterPlans: {
            ...state.fosterPlans,
            [fosterId]: movePlanTask(state.fosterPlans[fosterId], day, targetScheduledDay),
          },
        });
      },

      restartFosterPlan: (fosterId) => {
        const state = get();
        const foster = state.fosters.find((candidate) => candidate.id === fosterId);
        if (!foster || foster.isDemo || foster.adoptionStatus === 'Adopted') return;
        set({
          fosterPlans: {
            ...state.fosterPlans,
            [fosterId]: restartPlan(state.fosterPlans[fosterId]),
          },
        });
      },

      togglePhoto: (label) => {
        const state = get();
        const foster = state.fosters.find((candidate) => candidate.id === state.activeFosterId);
        const goalId = goalIdForLabel('photo', label);
        if (!foster || !goalId) return;
        const current = state.coachGoals.find(
          (goal) =>
            goal.fosterId === foster.id && goal.mediaType === 'photo' && goal.goalId === goalId
        );
        get().setCoachGoalManualCompletion(
          foster.id,
          'photo',
          goalId,
          !(current?.manuallyCompleted ?? false)
        );
      },

      toggleVideo: (label) => {
        const state = get();
        const foster = state.fosters.find((candidate) => candidate.id === state.activeFosterId);
        const goalId = goalIdForLabel('video', label);
        if (!foster || !goalId) return;
        const current = state.coachGoals.find(
          (goal) =>
            goal.fosterId === foster.id && goal.mediaType === 'video' && goal.goalId === goalId
        );
        get().setCoachGoalManualCompletion(
          foster.id,
          'video',
          goalId,
          !(current?.manuallyCompleted ?? false)
        );
      },

      saveContentPost: (post) => {
        const normalized = normalizeOwnedContentPostMedia(post, get().mediaItems);
        const current = get().contentPosts;
        const existingIndex = current.findIndex((candidate) => candidate.id === post.id);
        set({
          contentPosts:
            existingIndex === -1
              ? [...current, normalized]
              : current.map((candidate) => (candidate.id === post.id ? normalized : candidate)),
        });
      },

      updateContentPost: (id, changes) =>
        set({
          contentPosts: get().contentPosts.map((post) => {
            if (post.id !== id) return post;
            const next = { ...post, ...changes, id, updatedAt: new Date().toISOString() };
            return normalizeOwnedContentPostMedia(next, get().mediaItems);
          }),
        }),

      deleteContentPost: (id) =>
        set({ contentPosts: get().contentPosts.filter((post) => post.id !== id) }),

      duplicateContentPost: (id) => {
        const source = get().contentPosts.find((post) => post.id === id);
        if (!source) return;

        const now = new Date().toISOString();
        const duplicate: ContentPost = {
          ...source,
          id: createContentPostId(source.id),
          status: 'Draft',
          createdAt: now,
          updatedAt: now,
          keywords: [...source.keywords],
          hashtags: [...source.hashtags],
          notes: [...source.notes],
          warnings: [...source.warnings],
          mediaIds: [...contentPostMediaIds(source)],
          planDay: null,
          archivedFromStatus: undefined,
          versions: source.versions.map((version) => ({
            ...version,
            keywords: [...version.keywords],
            hashtags: [...version.hashtags],
            notes: [...version.notes],
            warnings: [...version.warnings],
            shotList: version.shotList ? [...version.shotList] : undefined,
          })),
        };
        set({ contentPosts: [...get().contentPosts, duplicate] });
      },

      setContentPostStatus: (id, status) =>
        set({
          contentPosts: get().contentPosts.map((post) => {
            if (post.id !== id) return post;
            const archivedFromStatus = status === 'Archived'
              ? (post.status === 'Archived' ? post.archivedFromStatus : post.status)
              : undefined;
            const restoredStatus = status === 'Draft' && post.status === 'Archived'
              ? (post.archivedFromStatus ?? 'Draft')
              : status;
            return { ...post, status: restoredStatus, archivedFromStatus, updatedAt: new Date().toISOString() };
          }),
        }),

      recordPublication: (contentPostId, platforms, notes = null) => {
        const state = get();
        const post = state.contentPosts.find((candidate) => candidate.id === contentPostId);
        const foster = post && state.fosters.find((candidate) => candidate.id === post.petId);
        if (!post || !foster || foster.isDemo || foster.adoptionStatus === 'Adopted') return [];

        const now = new Date().toISOString();
        const selectedPlatforms = [...new Set(platforms)];
        if (selectedPlatforms.length === 0) return [];

        const records: PublicationRecord[] = selectedPlatforms.map((platform, index) => ({
          id: `publication-${Date.now()}-${index}`,
          contentPostId: post.id,
          petId: post.petId,
          platform,
          postedAt: now,
          contentType: post.contentType,
          mediaId: post.primaryMediaId ?? null,
          notes: notes?.trim() || null,
          createdAt: now,
        }));
        const activities: MarketingActivity[] = records.map((record) => ({
          id: `marketing-${record.id}`,
          petId: record.petId,
          platform: record.platform,
          contentType: record.contentType,
          summary: post.hook.trim() || post.caption.trim(),
          occurredAt: record.postedAt,
          contentPostId: post.id,
          publicationRecordId: record.id,
          mediaId: record.mediaId,
          source: 'publication',
          createdAt: now,
        }));

        set({
          publicationRecords: [...state.publicationRecords, ...records],
          marketingActivities: [...state.marketingActivities, ...activities],
          contentPosts: state.contentPosts.map((candidate) =>
            candidate.id === post.id
              ? { ...candidate, status: 'Posted', updatedAt: now }
              : candidate
          ),
        });
        return records;
      },

      addManualMarketingActivity: (input) => {
        const state = get();
        const foster = state.fosters.find((candidate) => candidate.id === input.petId);
        if (!foster || foster.isDemo || foster.adoptionStatus === 'Adopted') return;
        const now = new Date().toISOString();
        const activity: MarketingActivity = {
          id: `manual-marketing-${Date.now()}`,
          petId: input.petId,
          platform: input.platform.trim() || 'Other',
          contentType: input.contentType.trim() || 'Post',
          summary: input.summary.trim(),
          occurredAt: input.occurredAt ?? now,
          contentPostId: null,
          publicationRecordId: null,
          mediaId: null,
          source: 'manual',
          createdAt: now,
        };
        set({ marketingActivities: [...state.marketingActivities, activity] });
      },

      addMediaItem: (media) => {
        const state = get();
        const foster = state.fosters.find((candidate) => candidate.id === media.fosterId);
        if (!foster || foster.isDemo || state.mediaItems.some((item) => item.id === media.id)) {
          return false;
        }
        set({ mediaItems: [...state.mediaItems, media] });
        return true;
      },

      addMediaItems: (media) => {
        const state = get();
        const fosterIds = new Set(
          state.fosters.filter((foster) => !foster.isDemo).map((foster) => foster.id)
        );
        const acceptedIds = new Set(state.mediaItems.map((item) => item.id));
        const accepted = media.filter((item) => {
          if (!fosterIds.has(item.fosterId) || acceptedIds.has(item.id)) return false;
          acceptedIds.add(item.id);
          return true;
        });
        if (accepted.length > 0) set({ mediaItems: [...state.mediaItems, ...accepted] });
        return accepted.length;
      },

      saveMediaAssets: async (options) => {
        const foster = get().fosters.find((candidate) => candidate.id === options.fosterId);
        if (!foster || foster.isDemo) {
          throw new Error('Media can only be saved for a real foster.');
        }

        const saved: MediaItem[] = [];
        for (const selectedAsset of options.assets) {
          let asset = selectedAsset;
          let existing = findMediaForAsset(
            get().mediaItems,
            options.fosterId,
            options.type,
            asset
          );
          if (existing && (await isBrokenMediaUri(mediaUri(existing)))) {
            asset = {
              ...asset,
              uri: existing.metadata.originalUri ?? asset.uri,
              assetId: existing.metadata.assetId ?? asset.assetId,
              fileName: existing.metadata.fileName ?? asset.fileName,
              mimeType: existing.metadata.mimeType ?? asset.mimeType,
            };
            set({
              mediaItems: get().mediaItems.map((item) =>
                item.id === existing?.id
                  ? { ...item, deletedAt: new Date().toISOString() }
                  : item
              ),
            });
            existing = undefined;
          }
          if (existing) {
            const tags = [...new Set([...existing.tags, ...(options.tags ?? [])])];
            if (tags.length !== existing.tags.length) {
              get().updateMediaItem(existing.id, { tags });
            }
            saved.push(get().mediaItems.find((item) => item.id === existing.id) ?? existing);
            continue;
          }

          const saveKey = `${options.fosterId}:${options.type}:${asset.assetId ?? asset.uri}`;
          let mediaPromise = mediaAssetSaves.get(saveKey);
          if (!mediaPromise) {
            let pendingSave: Promise<MediaItem>;
            pendingSave = (async () => {
              const [stored] = await storePickedMedia({ ...options, assets: [asset] });
              if (!stored) {
                throw new Error('The selected media could not be stored.');
              }
              if (get().addMediaItem(stored)) return stored;

              await deleteRemoteMediaCopies(stored).catch(() => undefined);
              await deleteStoredMediaFiles(stored);
              const duplicate = findMediaForAsset(
                get().mediaItems,
                options.fosterId,
                options.type,
                asset
              );
              if (!duplicate) {
                throw new Error('The selected media could not be added to the library.');
              }
              return duplicate;
            })().finally(() => {
              if (mediaAssetSaves.get(saveKey) === pendingSave) {
                mediaAssetSaves.delete(saveKey);
              }
            });
            mediaAssetSaves.set(saveKey, pendingSave);
            mediaPromise = pendingSave;
          }

          const stored = await mediaPromise;
          const tags = [...new Set([...stored.tags, ...(options.tags ?? [])])];
          if (tags.length !== stored.tags.length) {
            get().updateMediaItem(stored.id, { tags });
          }
          saved.push(get().mediaItems.find((item) => item.id === stored.id) ?? stored);
        }
        return saved;
      },

      ensureDurableMediaCopies: async () => {
        let fullySynced = true;
        for (const media of get().mediaItems) {
          if (media.deletedAt || (media.remoteUri && media.remoteThumbnailUri)) continue;

          const sourceUri = media.remoteUri ?? (await availableMediaSourceUri(media));
          const thumbnailIsAvailable =
            media.type === 'photo' ||
            Boolean(media.remoteThumbnailUri) ||
            !(await isBrokenMediaUri(media.thumbnailUri));
          if (!sourceUri || !thumbnailIsAvailable) {
            fullySynced = false;
            continue;
          }

          try {
            let copies: Awaited<ReturnType<typeof createDurableMediaCopies>> | null = null;
            for (let attempt = 0; attempt < 3; attempt += 1) {
              try {
                copies = await createDurableMediaCopies(media, sourceUri);
                break;
              } catch (error) {
                if (attempt === 2) throw error;
                await new Promise<void>((resolve) => {
                  setTimeout(resolve, 500 * (attempt + 1));
                });
              }
            }
            if (!copies) {
              fullySynced = false;
              continue;
            }

            const updatedMedia = { ...media, ...copies };
            const thumbnail = mediaUri(updatedMedia, true);
            const source = mediaUri(updatedMedia);
            set((state) => ({
              mediaItems: state.mediaItems.map((item) =>
                item.id === media.id ? { ...item, ...copies, updatedAt: new Date().toISOString() } : item
              ),
              fosters: state.fosters.map((foster) =>
                foster.photoUri && mediaMatchesUri(media, foster.photoUri)
                  ? { ...foster, photoUri: thumbnail }
                  : foster
              ),
              contentPosts: state.contentPosts.map((post) =>
                post.primaryMediaId === media.id && post.sourceUri && mediaMatchesUri(media, post.sourceUri)
                  ? { ...post, sourceUri: source, updatedAt: new Date().toISOString() }
                  : post
              ),
            }));
          } catch (error) {
            fullySynced = false;
            // Diagnostic only: do not log URIs, credentials, or server payloads.
            const code = error instanceof MediaUploadError ? error.code : 'MEDIA_RECONCILIATION_FAILED';
            console.warn(`[media-reconciliation] ${code}`);
          }
        }
        return fullySynced;
      },

      ensureFosterProfileMedia: async (fosterId) => {
        const foster = get().fosters.find((candidate) => candidate.id === fosterId);
        if (!foster || foster.isDemo || !foster.photoUri) return true;

        const importKey = `${fosterId}:${foster.photoUri}`;
        const existingImport = profileMediaImports.get(importKey);
        if (existingImport) return existingImport;

        let importPromise: Promise<boolean>;
        importPromise = (async () => {
          const currentFoster = get().fosters.find((candidate) => candidate.id === fosterId);
          if (!currentFoster || currentFoster.isDemo || !currentFoster.photoUri) return true;

          const sourceUri = currentFoster.photoUri;
          const [profileMedia] = await get().saveMediaAssets({
            fosterId,
            type: 'photo',
            assets: [
              {
                uri: sourceUri,
                width: 0,
                height: 0,
                type: 'image',
                fileName: null,
                assetId: null,
              },
            ],
            source: 'migration',
            tags: ['profile'],
          });

          const latestFoster = get().fosters.find((candidate) => candidate.id === fosterId);
          if (!latestFoster || latestFoster.photoUri !== sourceUri) return true;
          return Boolean(profileMedia && get().setFosterProfilePhotoFromMedia(fosterId, profileMedia.id));
        })()
          .catch(() => false)
          .finally(() => {
            if (profileMediaImports.get(importKey) === importPromise) {
              profileMediaImports.delete(importKey);
            }
          });

        profileMediaImports.set(importKey, importPromise);
        return importPromise;
      },

      ensureContentPostMedia: async (postId) => {
        const post = get().contentPosts.find((candidate) => candidate.id === postId);
        if (!post) return true;

        // A stale URI-only post can otherwise cause an asset belonging to a
        // different foster to be imported under this foster during sharing.
        const ownershipNormalized = normalizeOwnedContentPostMedia(post, get().mediaItems);
        if (
          ownershipNormalized.sourceUri !== post.sourceUri ||
          ownershipNormalized.primaryMediaId !== post.primaryMediaId ||
          contentPostMediaIds(ownershipNormalized).join('|') !== contentPostMediaIds(post).join('|')
        ) {
          set({
            contentPosts: get().contentPosts.map((candidate) =>
              candidate.id === postId ? ownershipNormalized : candidate
            ),
          });
          return false;
        }

        const referencedIds = contentPostMediaIds(post);
        const attachmentsAreAvailable = referencedIds.every((mediaId) =>
          get().mediaItems.some(
            (media) => media.id === mediaId && media.fosterId === post.petId && !media.deletedAt
          )
        );
        if (
          !post.sourceUri ||
          (post.sourceType !== 'photo' && post.sourceType !== 'video')
        ) {
          return attachmentsAreAvailable;
        }
        const secondaryAttachmentsAreAvailable = referencedIds
          .filter((mediaId) => mediaId !== post.primaryMediaId)
          .every((mediaId) =>
            get().mediaItems.some(
              (media) => media.id === mediaId && media.fosterId === post.petId && !media.deletedAt
            )
          );
        if (!secondaryAttachmentsAreAvailable) return false;

        const importKey = `${postId}:${post.primaryMediaId ?? ''}:${post.sourceUri}`;
        const existingImport = contentMediaImports.get(importKey);
        if (existingImport) return existingImport;

        let importPromise: Promise<boolean>;
        importPromise = (async () => {
          const currentPost = get().contentPosts.find((candidate) => candidate.id === postId);
          if (
            !currentPost ||
            !currentPost.sourceUri ||
            (currentPost.sourceType !== 'photo' && currentPost.sourceType !== 'video')
          ) {
            return true;
          }

          let brokenReferencedMediaId: string | null = null;
          let referencedMedia = get().mediaItems.find(
            (media) =>
              media.id === currentPost.primaryMediaId &&
              media.fosterId === currentPost.petId &&
              media.type === currentPost.sourceType &&
              !media.deletedAt
          );
          if (referencedMedia && (await isBrokenMediaUri(mediaUri(referencedMedia)))) {
            const brokenMediaId = referencedMedia.id;
            brokenReferencedMediaId = brokenMediaId;
            const deletedAt = new Date().toISOString();
            set({
              mediaItems: get().mediaItems.map((item) =>
                item.id === brokenMediaId ? { ...item, deletedAt, updatedAt: deletedAt } : item
              ),
            });
            referencedMedia = undefined;
          }
          const media =
            referencedMedia ??
            (
              await get().saveMediaAssets({
                fosterId: currentPost.petId,
                type: currentPost.sourceType,
                assets: [
                  {
                    uri: currentPost.sourceUri,
                    width: 0,
                    height: 0,
                    type: currentPost.sourceType === 'photo' ? 'image' : 'video',
                    fileName: null,
                    assetId: null,
                  },
                ],
                source: 'migration',
              })
            )[0];

          if (!media) return false;
          const latestPost = get().contentPosts.find((candidate) => candidate.id === postId);
          if (
            !latestPost ||
            latestPost.petId !== currentPost.petId ||
            latestPost.sourceType !== currentPost.sourceType ||
            latestPost.primaryMediaId !== currentPost.primaryMediaId ||
            latestPost.sourceUri !== currentPost.sourceUri
          ) {
            return true;
          }
          const sourceUri = mediaUri(media);
          const retainedMediaIds = contentPostMediaIds(latestPost).filter(
            (mediaId) => mediaId !== brokenReferencedMediaId
          );
          const normalizedMedia = normalizeContentPostMedia(
            [...retainedMediaIds, media.id],
            latestPost.primaryMediaId === brokenReferencedMediaId
              ? media.id
              : latestPost.primaryMediaId ?? media.id
          );
          if (
            latestPost.primaryMediaId !== normalizedMedia.primaryMediaId ||
            latestPost.sourceUri !== sourceUri ||
            contentPostMediaIds(latestPost).join('|') !== normalizedMedia.mediaIds.join('|')
          ) {
            set({
              contentPosts: get().contentPosts.map((post) =>
                post.id === postId
                  ? { ...post, ...normalizedMedia, sourceUri }
                  : post
              ),
            });
          }
          return true;
        })()
          .catch(() => false)
          .finally(() => {
            if (contentMediaImports.get(importKey) === importPromise) {
              contentMediaImports.delete(importKey);
            }
          });

        contentMediaImports.set(importKey, importPromise);
        return importPromise;
      },

      updateMediaItem: (id, changes) => {
        const state = get();
        const current = state.mediaItems.find((item) => item.id === id);
        if (!current || current.deletedAt) return;
        const now = new Date().toISOString();
        const updated: MediaItem = {
          ...current,
          ...changes,
          id: current.id,
          fosterId: current.fosterId,
          tags: changes.tags ? [...new Set(changes.tags)] : current.tags,
          metadata: changes.metadata
            ? { ...current.metadata, ...changes.metadata }
            : current.metadata,
          updatedAt: now,
        };
        const nextProfileUri = mediaUri(updated, true);
        set({
          mediaItems: state.mediaItems.map((item) => (item.id === id ? updated : item)),
          fosters: state.fosters.map((foster) =>
            foster.id === current.fosterId && foster.photoUri && mediaMatchesUri(current, foster.photoUri)
              ? { ...foster, photoUri: nextProfileUri }
              : foster
          ),
          contentPosts: state.contentPosts.map((post) =>
            post.primaryMediaId === id
              ? { ...post, sourceUri: mediaUri(updated), updatedAt: now }
              : post
          ),
        });
      },

      updateMediaDetails: (id, changes) => {
        const media = get().mediaItems.find((item) => item.id === id);
        if (!media || media.deletedAt) return;
        get().updateMediaItem(id, {
          metadata: {
            ...media.metadata,
            title: changes.title ?? media.metadata.title,
            notes: changes.notes ?? media.metadata.notes,
          },
          tags: changes.tags ? [...changes.tags] : media.tags,
        });
      },

      setMediaFavorite: (id, favorite) => get().updateMediaItem(id, { favorite }),
      toggleMediaFavorite: (id) => {
        const media = get().mediaItems.find((item) => item.id === id);
        if (media) get().setMediaFavorite(id, !media.favorite);
      },

      deleteMediaItem: async (id) => {
        const state = get();
        const media = state.mediaItems.find((item) => item.id === id);
        if (!media || media.deletedAt) return false;
        // Legacy records have no server object IDs and keep their established local-only behavior.
        // Owned Launch 1B objects must be removed remotely before local references disappear.
        try {
          await deleteRemoteMediaCopies(media);
        } catch {
          return false;
        }
        const deletedAt = new Date().toISOString();
        set({
          mediaItems: state.mediaItems.map((item) =>
            item.id === id ? { ...item, deletedAt, updatedAt: deletedAt } : item
          ),
          coachGoals: state.coachGoals.map((goal) => ({
            ...goal,
            mediaIds: goal.mediaIds.filter((mediaId) => mediaId !== id),
            updatedAt: goal.mediaIds.includes(id) ? deletedAt : goal.updatedAt,
          })),
          contentPosts: state.contentPosts.map((post) => {
            const postMediaIds = contentPostMediaIds(post);
            const referencesId = postMediaIds.includes(id);
            const referencesUri = Boolean(post.sourceUri && mediaMatchesUri(media, post.sourceUri));
            if (!referencesId && !referencesUri) return post;

            const remainingMediaIds = postMediaIds.filter((mediaId) => mediaId !== id);
            const nextPrimaryMediaId = remainingMediaIds[0] ?? null;
            const replacement = nextPrimaryMediaId
              ? state.mediaItems.find(
                  (item) => item.id === nextPrimaryMediaId && !item.deletedAt && item.fosterId === post.petId
                )
              : undefined;
            return {
              ...post,
              mediaIds: remainingMediaIds,
              primaryMediaId: nextPrimaryMediaId,
              sourceUri: replacement ? mediaUri(replacement) : null,
              updatedAt: deletedAt,
            };
          }),
          fosters: state.fosters.map((foster) =>
            foster.id === media.fosterId
              ? {
                  ...foster,
                  photoUri:
                    foster.photoUri && mediaMatchesUri(media, foster.photoUri)
                      ? null
                      : foster.photoUri,
                  successStoryPhotoMediaId:
                    foster.successStoryPhotoMediaId === id
                      ? null
                      : (foster.successStoryPhotoMediaId ?? null),
                }
              : foster
          ),
          ...legacyCoachLists(
            state.coachGoals.map((goal) => ({
              ...goal,
              mediaIds: goal.mediaIds.filter((mediaId) => mediaId !== id),
            })),
            state.fosters,
            state.activeFosterId
          ),
        });
        await deleteStoredMediaFiles(media);
        return true;
      },

      setFosterProfilePhotoFromMedia: (fosterId, mediaId) => {
        const state = get();
        const media = state.mediaItems.find(
          (item) =>
            item.id === mediaId &&
            item.fosterId === fosterId &&
            item.type === 'photo' &&
            !item.deletedAt
        );
        const foster = state.fosters.find((candidate) => candidate.id === fosterId);
        if (!media || !foster || foster.isDemo) return false;
        const profileUri = mediaUri(media, true);
        const tagsAreCurrent = state.mediaItems.every(
          (item) =>
            item.fosterId !== fosterId ||
            item.type !== 'photo' ||
            (item.id === mediaId ? item.tags.includes('profile') : !item.tags.includes('profile'))
        );
        if (foster.photoUri === profileUri && tagsAreCurrent) return true;
        const now = new Date().toISOString();
        set({
          fosters: state.fosters.map((candidate) =>
            candidate.id === fosterId
              ? { ...candidate, photoUri: profileUri }
              : candidate
          ),
          mediaItems: state.mediaItems.map((item) => {
            if (item.fosterId !== fosterId || item.type !== 'photo') return item;
            const tags: MediaCategoryTag[] = item.tags.filter((tag) => tag !== 'profile');
            if (item.id === mediaId) tags.push('profile');
            return tags.length === item.tags.length && tags.every((tag, index) => tag === item.tags[index])
              ? item
              : { ...item, tags, updatedAt: now };
          }),
        });
        return true;
      },

      setFosterSuccessStoryPhoto: (fosterId, mediaId) => {
        const state = get();
        const foster = state.fosters.find((candidate) => candidate.id === fosterId);
        const media = mediaId
          ? state.mediaItems.find(
              (item) =>
                item.id === mediaId &&
                item.fosterId === fosterId &&
                item.type === 'photo' &&
                !item.deletedAt
            )
          : null;
        if (!foster || foster.isDemo || (mediaId && !media)) return false;
        const now = new Date().toISOString();
        set({
          fosters: state.fosters.map((candidate) =>
            candidate.id === fosterId
              ? { ...candidate, successStoryPhotoMediaId: mediaId }
              : candidate
          ),
          mediaItems: state.mediaItems.map((item) => {
            if (item.fosterId !== fosterId || item.type !== 'photo') return item;
            const tags: MediaCategoryTag[] = item.tags.filter((tag) => tag !== 'success-story');
            if (item.id === mediaId) tags.push('success-story');
            return tags.length === item.tags.length && tags.every((tag, index) => tag === item.tags[index])
              ? item
              : { ...item, tags, updatedAt: now };
          }),
        });
        return true;
      },

      attachMediaToCoachGoal: (fosterId, mediaType, goalId, mediaId) => {
        if (!coachOptions(mediaType).some((goal) => goal.id === goalId)) return false;
        const state = get();
        const media = state.mediaItems.find(
          (item) =>
            item.id === mediaId &&
            item.fosterId === fosterId &&
            item.type === mediaType &&
            !item.deletedAt
        );
        const foster = state.fosters.find((candidate) => candidate.id === fosterId);
        if (!media || !foster || foster.isDemo || foster.adoptionStatus === 'Adopted') return false;
        const now = new Date().toISOString();
        const coachGoals = upsertCoachGoal(
          state.coachGoals,
          fosterId,
          mediaType,
          goalId,
          (goal) => ({
            ...goal,
            mediaIds: goal.mediaIds.includes(mediaId)
              ? goal.mediaIds
              : [...goal.mediaIds, mediaId],
            updatedAt: now,
          })
        );
        set({
          coachGoals,
          ...legacyCoachLists(coachGoals, state.fosters, state.activeFosterId),
        });
        return true;
      },

      detachMediaFromCoachGoal: (fosterId, mediaType, goalId, mediaId) => {
        if (!coachOptions(mediaType).some((goal) => goal.id === goalId)) return;
        const state = get();
        const coachGoals = upsertCoachGoal(
          state.coachGoals,
          fosterId,
          mediaType,
          goalId,
          (goal) => ({
            ...goal,
            mediaIds: goal.mediaIds.filter((candidate) => candidate !== mediaId),
            updatedAt: new Date().toISOString(),
          })
        );
        set({
          coachGoals,
          ...legacyCoachLists(coachGoals, state.fosters, state.activeFosterId),
        });
      },

      setCoachGoalManualCompletion: (fosterId, mediaType, goalId, completed) => {
        if (!coachOptions(mediaType).some((goal) => goal.id === goalId)) return;
        const state = get();
        const foster = state.fosters.find((candidate) => candidate.id === fosterId);
        if (!foster || foster.isDemo || foster.adoptionStatus === 'Adopted') return;
        const coachGoals = upsertCoachGoal(
          state.coachGoals,
          fosterId,
          mediaType,
          goalId,
          (goal) => ({
            ...goal,
            manuallyCompleted: completed,
            updatedAt: new Date().toISOString(),
          })
        );
        set({
          coachGoals,
          ...legacyCoachLists(coachGoals, state.fosters, state.activeFosterId),
        });
      },

      saveAdoptionBoostRecommendation: (recommendation) => {
        const state = get();
        const foster = state.fosters.find((candidate) => candidate.id === recommendation.petId);
        if (!foster || foster.isDemo || foster.adoptionStatus === 'Adopted') return;
        set({
          adoptionBoostRecommendations: [
            ...state.adoptionBoostRecommendations.filter(
              (item) => !(item.petId === recommendation.petId && item.dateKey === recommendation.dateKey)
            ),
            recommendation,
          ],
        });
      },

      dismissAdoptionBoostCategory: (fosterId, category) => {
        const state = get();
        const foster = state.fosters.find((candidate) => candidate.id === fosterId);
        if (!foster || foster.isDemo) return;
        const dismissed = state.dismissedBoostCategories[fosterId] ?? [];
        set({
          dismissedBoostCategories: {
            ...state.dismissedBoostCategories,
            [fosterId]: dismissed.includes(category) ? dismissed : [...dismissed, category],
          },
          adoptionBoostRecommendations: state.adoptionBoostRecommendations.filter(
            (item) => !(item.petId === fosterId && item.category === category)
          ),
        });
      },

      startAdoptionBoostCampaign: (fosterId) => {
        const state = get();
        const foster = state.fosters.find((candidate) => candidate.id === fosterId);
        if (!foster || foster.isDemo || foster.adoptionStatus === 'Adopted') return null;
        const existing = state.adoptionBoostCampaigns.find(
          (campaign) => campaign.petId === fosterId && campaign.status === 'Active'
        );
        if (existing) return existing;

        const now = new Date().toISOString();
        const campaign: AdoptionBoostCampaign = {
          id: `adoption-boost-${fosterId}-${Date.now()}`,
          petId: fosterId,
          startedAt: now,
          completedAt: null,
          status: 'Active',
          currentDay: 1,
          createdAt: now,
          updatedAt: now,
        };
        const tasks: AdoptionBoostTask[] = BOOST_TASKS.map((definition) => ({
          id: `${campaign.id}-day-${definition.day}`,
          campaignId: campaign.id,
          petId: fosterId,
          day: definition.day,
          taskType: definition.taskType,
          status: 'Todo',
          completedAt: null,
          skippedAt: null,
          linkedContentPostId: null,
          createdAt: now,
          updatedAt: now,
        }));
        set({
          adoptionBoostCampaigns: [...state.adoptionBoostCampaigns, campaign],
          adoptionBoostTasks: [...state.adoptionBoostTasks, ...tasks],
        });
        return campaign;
      },

      updateAdoptionBoostTask: (campaignId, taskId, status, linkedContentPostId = null) => {
        const state = get();
        const task = state.adoptionBoostTasks.find(
          (item) => item.id === taskId && item.campaignId === campaignId
        );
        const foster = task && state.fosters.find((candidate) => candidate.id === task.petId);
        if (!task || !foster || foster.adoptionStatus === 'Adopted') return;
        const now = new Date().toISOString();
        const adoptionBoostTasks = state.adoptionBoostTasks.map((item) =>
          item.id !== taskId
            ? item
            : {
                ...item,
                status,
                completedAt: status === 'Completed' ? now : item.completedAt,
                skippedAt: status === 'Skipped' ? now : item.skippedAt,
                linkedContentPostId: linkedContentPostId ?? item.linkedContentPostId,
                updatedAt: now,
              }
        );
        const campaignTasks = adoptionBoostTasks.filter((item) => item.campaignId === campaignId);
        const isComplete = campaignTasks.length > 0 && campaignTasks.every((item) => item.status !== 'Todo');
        const nextTodo = campaignTasks.find((item) => item.status === 'Todo');
        set({
          adoptionBoostTasks,
          adoptionBoostCampaigns: state.adoptionBoostCampaigns.map((campaign) =>
            campaign.id !== campaignId
              ? campaign
              : {
                  ...campaign,
                  currentDay: nextTodo?.day ?? 7,
                  status: isComplete ? 'Completed' : campaign.status,
                  completedAt: isComplete ? now : campaign.completedAt,
                  updatedAt: now,
                }
          ),
        });
      },

      replaceAdoptionBoostTask: (campaignId, taskId) => {
        const state = get();
        const current = state.adoptionBoostTasks.find((item) => item.id === taskId && item.campaignId === campaignId);
        const foster = current && state.fosters.find((candidate) => candidate.id === current.petId);
        if (!current || !foster || foster.isDemo || foster.adoptionStatus === 'Adopted' || current.status !== 'Todo') return null;
        const campaignTasks = state.adoptionBoostTasks.filter((item) => item.campaignId === campaignId);
        const rejectedTypes = new Set(campaignTasks.filter((item) => item.status === 'Replaced').map((item) => item.taskType));
        const remainingTypes = BOOST_TASKS.map((definition) => definition.taskType).filter((taskType) => taskType !== current.taskType && !rejectedTypes.has(taskType));
        const taskType = remainingTypes[0];
        if (!taskType) return null;
        const now = new Date().toISOString();
        const replacement: AdoptionBoostTask = {
          id: `${current.id}-alternative-${Date.now()}`,
          campaignId,
          petId: current.petId,
          day: current.day,
          taskType,
          status: 'Todo',
          completedAt: null,
          skippedAt: null,
          linkedContentPostId: null,
          createdAt: now,
          updatedAt: now,
        };
        set({
          adoptionBoostTasks: [
            ...state.adoptionBoostTasks.map((item) => item.id === current.id ? { ...item, status: 'Replaced' as const, updatedAt: now } : item),
            replacement,
          ],
          adoptionBoostCampaigns: state.adoptionBoostCampaigns.map((campaign) => campaign.id === campaignId ? { ...campaign, currentDay: replacement.day, updatedAt: now } : campaign),
        });
        return replacement;
      },
    }),
    {
      name: 'foster-famous-v1',
      version: STORE_VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (persistedState) => migratePersistedState(persistedState),
      partialize: (state) => ({
        onboardingComplete: state.onboardingComplete,
        fosterPreference: state.fosterPreference,
        helpTopics: state.helpTopics,
        defaultRescueInformation: state.defaultRescueInformation,
        fosters: state.fosters,
        activeFosterId: state.activeFosterId,
        planStatus: state.planStatus,
        fosterPlans: state.fosterPlans,
        photosCaptured: state.photosCaptured,
        videosCaptured: state.videosCaptured,
        contentPosts: state.contentPosts,
        publicationRecords: state.publicationRecords,
        marketingActivities: state.marketingActivities,
        mediaItems: state.mediaItems,
        coachGoals: state.coachGoals,
        adoptionBoostRecommendations: state.adoptionBoostRecommendations,
        dismissedBoostCategories: state.dismissedBoostCategories,
        adoptionBoostCampaigns: state.adoptionBoostCampaigns,
        adoptionBoostTasks: state.adoptionBoostTasks,
      }),
      onRehydrateStorage: () => () => {
        useAppStore.setState({ hydrated: true });
      },
    }
  )
);

export function migratePersistedState(persistedState: unknown): Partial<AppState> {
  if (!persistedState || typeof persistedState !== 'object') return {};
  const state = persistedState as Partial<AppState>;
  const savedRescueInformation = state.defaultRescueInformation;
  const defaultRescueInformation: DefaultRescueInformation = {
    ...EMPTY_RESCUE_INFORMATION,
    ...(savedRescueInformation && typeof savedRescueInformation === 'object'
      ? savedRescueInformation
      : {}),
  };
  const fosters = Array.isArray(state.fosters)
    ? state.fosters.filter((foster) => !foster.isDemo).map((foster) => {
        const savedPlacement = foster.adoptionStatus as string | undefined;
        const adoptionStatus: AdoptionStatus = ADOPTION_STATUSES.includes(savedPlacement as AdoptionStatus)
          ? (savedPlacement as AdoptionStatus)
          : 'Not Yet Available';
        const normalized = {
          ...foster,
          fosterStartDate: normalizePersistedFosterDate(foster.fosterStartDate),
          adoptionStatus,
          successStoryPhotoMediaId: foster.successStoryPhotoMediaId ?? null,
          currentStatus: foster.currentStatus?.trim() ?? '',
          progressUpdates: Array.isArray(foster.progressUpdates)
            ? foster.progressUpdates.map((update) => ({
                ...update,
                category: update.category ?? 'General Update',
              }))
            : [],
          currentInfoUpdatedAt: foster.currentInfoUpdatedAt,
        } as Foster;
        const fosterPeriods = ensureFosterPeriods(normalized);
        return {
          ...normalized,
          fosterPeriods,
          adoptionEvents: ensureAdoptionEvents(normalized, fosterPeriods),
        };
      })
    : [];
  const mediaItems = Array.isArray(state.mediaItems) ? state.mediaItems : [];
  const contentPosts = Array.isArray(state.contentPosts)
    ? state.contentPosts.map((post) => {
        const legacyStatus = post.status as string | undefined;
        const status: ContentPostStatus =
          legacyStatus === 'Ready'
            ? 'Ready to Post'
            : legacyStatus === 'Published Manually'
              ? 'Posted'
              : legacyStatus === 'Ready to Post' || legacyStatus === 'Posted' || legacyStatus === 'Archived'
                ? legacyStatus
                : 'Draft';
        return normalizeOwnedContentPostMedia(
          {
            ...post,
            status,
            creationMode: (post.creationMode === 'manual' ? 'manual' : 'ai') as ContentCreationMode,
            ...normalizeContentPostMedia(post.mediaIds, post.primaryMediaId),
          },
          mediaItems
        );
      })
    : [];
  const publicationRecords = Array.isArray(state.publicationRecords)
    ? state.publicationRecords
    : [];
  const marketingActivities = Array.isArray(state.marketingActivities)
    ? state.marketingActivities
    : [];
  let coachGoals = Array.isArray(state.coachGoals) ? state.coachGoals : [];
  const adoptionBoostRecommendations = Array.isArray(state.adoptionBoostRecommendations)
    ? state.adoptionBoostRecommendations
    : [];
  const dismissedBoostCategories =
    state.dismissedBoostCategories && typeof state.dismissedBoostCategories === 'object'
      ? state.dismissedBoostCategories
      : {};
  const adoptionBoostCampaigns = Array.isArray(state.adoptionBoostCampaigns)
    ? state.adoptionBoostCampaigns
    : [];
  const adoptionBoostTasks = Array.isArray(state.adoptionBoostTasks) ? state.adoptionBoostTasks : [];
  const savedPlans = state.fosterPlans && typeof state.fosterPlans === 'object'
    ? state.fosterPlans as Record<string, FosterPlanState>
    : {};
  const legacyPlanStatus = state.planStatus && typeof state.planStatus === 'object'
    ? state.planStatus
    : {};
  const fosterPlans: Record<string, FosterPlanState> = { ...savedPlans };
  // The old global plan could only describe the active foster. Never copy fake progress to others.
  if (Object.keys(fosterPlans).length === 0 && state.activeFosterId && fosters.some((foster) => foster.id === state.activeFosterId)) {
    fosterPlans[state.activeFosterId] = migrationPlanFromLegacy(legacyPlanStatus);
  }

  if (coachGoals.length === 0 && fosters.length > 0) {
    const targetFosterId =
      fosters.find((foster) => foster.id === state.activeFosterId)?.id ?? fosters[0].id;
    const now = new Date().toISOString();
    const migratedPhotos = Array.isArray(state.photosCaptured) ? state.photosCaptured : [];
    const migratedVideos = Array.isArray(state.videosCaptured) ? state.videosCaptured : [];
    coachGoals = [
      ...PHOTO_COACH_GOALS.filter((goal) => migratedPhotos.includes(goal.label)).map((goal) => ({
        fosterId: targetFosterId,
        mediaType: 'photo' as const,
        goalId: goal.id,
        manuallyCompleted: true,
        mediaIds: [],
        updatedAt: now,
      })),
      ...VIDEO_COACH_GOALS.filter((goal) => migratedVideos.includes(goal.label)).map((goal) => ({
        fosterId: targetFosterId,
        mediaType: 'video' as const,
        goalId: goal.id,
        manuallyCompleted: true,
        mediaIds: [],
        updatedAt: now,
      })),
    ];
  }

  const activeFosterId =
    fosters.find((foster) => foster.id === state.activeFosterId && isActiveFoster(foster))?.id ??
    fosters.find(isActiveFoster)?.id ??
    null;

  const legacyLists =
    fosters.length > 0
      ? legacyCoachLists(coachGoals, fosters, activeFosterId)
      : {
          photosCaptured: Array.isArray(state.photosCaptured)
            ? state.photosCaptured
            : [...DEMO_PHOTOS_CAPTURED],
          videosCaptured: Array.isArray(state.videosCaptured)
            ? state.videosCaptured
            : [...DEMO_VIDEOS_CAPTURED],
        };

  return {
    ...state,
    fosters,
    activeFosterId,
    defaultRescueInformation,
    fosterPlans,
    contentPosts,
    publicationRecords,
    marketingActivities,
    mediaItems,
    coachGoals,
    adoptionBoostRecommendations,
    dismissedBoostCategories,
    adoptionBoostCampaigns,
    adoptionBoostTasks,
    ...legacyLists,
  };
}

/** Samples are displayed only while the user has no fosters of their own. */
export function useDisplayFosters(): readonly Foster[] {
  const fosters = useAppStore((state) => state.fosters);
  return fosters.length > 0 ? fosters : DEMO_FOSTERS;
}

/** Fosters eligible for active marketing tools. Adopted profiles remain in useDisplayFosters only. */
export function useActiveFosters(): readonly Foster[] {
  const realFosters = useAppStore((state) => state.fosters);
  return realFosters.length === 0 ? DEMO_FOSTERS : realFosters.filter(isActiveFoster);
}

/**
 * Compatibility selector for existing screens. New marketing surfaces should
 * use useActiveFosters and render an empty state when every foster is adopted.
 */
export function useActiveFoster(): Foster {
  const activeFosters = useActiveFosters();
  const allFosters = useDisplayFosters();
  const activeId = useAppStore((state) => state.activeFosterId);
  return (
    activeFosters.find((foster) => foster.id === activeId) ??
    activeFosters[0] ??
    allFosters.find((foster) => foster.id === activeId) ??
    allFosters[0]
  );
}

export function findFoster(fosters: readonly Foster[], id: string | undefined): Foster {
  return fosters.find((foster) => foster.id === id) ?? fosters[0];
}

export function getContentPostsForFoster(
  contentPosts: readonly ContentPost[],
  fosterId: string | null | undefined
): readonly ContentPost[] {
  return fosterId ? contentPosts.filter((post) => post.petId === fosterId) : contentPosts;
}

export function findContentPost(
  contentPosts: readonly ContentPost[],
  id: string | null | undefined
): ContentPost | undefined {
  return contentPosts.find((post) => post.id === id);
}

export function useContentPostsForFoster(
  fosterId: string | null | undefined
): readonly ContentPost[] {
  const contentPosts = useAppStore((state) => state.contentPosts);
  return getContentPostsForFoster(contentPosts, fosterId);
}

export function getMediaForFoster(
  mediaItems: readonly MediaItem[],
  fosterId: string | null | undefined,
  options: { includeDeleted?: boolean; type?: CoachMediaType; favoritesOnly?: boolean } = {}
): readonly MediaItem[] {
  if (!fosterId) return [];
  return mediaItems.filter(
    (media) =>
      media.fosterId === fosterId &&
      (options.includeDeleted || !media.deletedAt) &&
      (!options.type || media.type === options.type) &&
      (!options.favoritesOnly || media.favorite)
  );
}

export function findMediaItem(
  mediaItems: readonly MediaItem[],
  id: string | null | undefined,
  includeDeleted = false
): MediaItem | undefined {
  return mediaItems.find((media) => media.id === id && (includeDeleted || !media.deletedAt));
}

export function getCoachGoalsForFoster(
  coachGoals: readonly CoachGoalRecord[],
  fosterId: string | null | undefined,
  mediaType?: CoachMediaType
): readonly CoachGoalRecord[] {
  if (!fosterId) return [];
  return coachGoals.filter(
    (goal) => goal.fosterId === fosterId && (!mediaType || goal.mediaType === mediaType)
  );
}

export function isCoachGoalRecordComplete(goal: CoachGoalRecord | undefined): boolean {
  return isGoalComplete(goal);
}
