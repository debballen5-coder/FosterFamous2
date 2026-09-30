import { isContentPostStale } from './foster-current-info';
import type { CoachGoalRecord, ContentPost, Foster, MarketingActivity, MediaItem, PublicationRecord } from './types';

export interface FosterScoreCategory {
  key: 'profile' | 'photos' | 'video' | 'bio' | 'activity' | 'variety';
  label: string;
  earned: number;
  possible: number;
}

export interface LiveFosterFamousScore {
  overall: number;
  categories: readonly FosterScoreCategory[];
  biggestOpportunity: string;
  destination: 'profile' | 'photo-coach' | 'video-coach' | 'adoption-bio' | 'post-builder';
  destinationParams: Record<string, string>;
}

export interface FosterScoreInput {
  foster: Foster;
  mediaItems: readonly MediaItem[];
  coachGoals: readonly CoachGoalRecord[];
  contentPosts: readonly ContentPost[];
  publicationRecords: readonly PublicationRecord[];
  marketingActivities: readonly MarketingActivity[];
  now?: Date;
}

function completeGoal(
  goals: readonly CoachGoalRecord[],
  fosterId: string,
  mediaType: 'photo' | 'video',
  goalId: string
): boolean {
  const goal = goals.find((item) => item.fosterId === fosterId && item.mediaType === mediaType && item.goalId === goalId);
  return Boolean(goal?.manuallyCompleted || (goal?.mediaIds.length ?? 0) > 0);
}

function scoreProfile(foster: Foster): number {
  let score = 0;
  if (foster.name.trim() && foster.species) score += 3;
  if (foster.age.trim()) score += 2;
  if (foster.breed.trim() || foster.size || foster.weight.trim()) score += 2;
  if (foster.personality.length > 0 || foster.personalityNotes.trim()) score += 3;
  if (foster.adoptionStatus) score += 2;
  if ([foster.goodWithDogs, foster.goodWithCats, foster.goodWithChildren].some((value) => value !== 'Unknown')) score += 2;
  if (foster.energyLevel || foster.houseTrained !== 'Unknown' || foster.crateTrained !== 'Unknown') score += 2;
  if (foster.rescueName.trim() || foster.contactMethod.trim() || foster.adoptionUrl.trim()) score += 2;
  if (foster.currentStatus?.trim() || (foster.progressUpdates?.length ?? 0) > 0) score += 2;
  return Math.min(score, 20);
}

function scorePhotos(input: FosterScoreInput): number {
  const photos = input.mediaItems.filter((item) => item.fosterId === input.foster.id && item.type === 'photo' && !item.deletedAt);
  const has = (goalId: string, tags: readonly string[]) => completeGoal(input.coachGoals, input.foster.id, 'photo', goalId) || photos.some((photo) => tags.some((tag) => photo.tags.includes(tag as typeof photo.tags[number])));
  let score = 0;
  if (input.foster.photoUri || has('hero-adoption-photo', ['hero', 'profile'])) score += 6;
  if (has('face-close-up', ['face', 'portrait'])) score += 4;
  if (has('full-body', ['full-body', 'person-scale'])) score += 4;
  if (has('relaxing-indoors', ['indoors', 'calm', 'day-in-life']) || has('calm-moment', ['calm', 'cuddling'])) score += 3;
  if (photos.length >= 3) score += 2;
  if (photos.length >= 6) score += 1;
  return Math.min(score, 20);
}

function scoreVideo(input: FosterScoreInput): number {
  const videos = input.mediaItems.filter((item) => item.fosterId === input.foster.id && item.type === 'video' && !item.deletedAt);
  const goals = input.coachGoals.filter((goal) => goal.fosterId === input.foster.id && goal.mediaType === 'video' && (goal.manuallyCompleted || goal.mediaIds.length > 0));
  const videoPosts = input.publicationRecords.filter((record) => record.petId === input.foster.id && record.contentType === 'Reel / TikTok Script');
  let score = 0;
  if (videos.length > 0 || goals.length > 0) score += 7;
  if (videos.length >= 2 || goals.length >= 2) score += 4;
  if (videoPosts.length > 0) score += 4;
  return Math.min(score, 15);
}

function scoreBio(input: FosterScoreInput): number {
  const bio = input.contentPosts
    .filter((post) => post.petId === input.foster.id && (post.contentType === 'Adoption Bio' || post.contentType === 'Petfinder / Rescue Listing') && post.status !== 'Archived')
    .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))[0];
  if (!bio) return 0;
  return isContentPostStale(bio, input.foster) ? 8 : 15;
}

function activityWithin(records: readonly { occurredAt?: string; postedAt?: string }[], days: number, now: Date): number {
  const threshold = now.getTime() - days * 86_400_000;
  return records.filter((record) => {
    const value = record.occurredAt ?? record.postedAt;
    const timestamp = value ? new Date(value).getTime() : Number.NaN;
    return Number.isFinite(timestamp) && timestamp >= threshold;
  }).length;
}

function scoreActivity(input: FosterScoreInput, now: Date): number {
  const publications = input.publicationRecords.filter((record) => record.petId === input.foster.id);
  const manual = input.marketingActivities.filter((record) => record.petId === input.foster.id && record.source === 'manual');
  const all = [...publications.map((record) => ({ postedAt: record.postedAt })), ...manual.map((record) => ({ occurredAt: record.occurredAt }))];
  const recentWeek = activityWithin(all, 7, now);
  const recentMonth = activityWithin(all, 30, now);
  if (recentWeek >= 3) return 20;
  if (recentWeek >= 2) return 17;
  if (recentWeek >= 1) return 13;
  if (recentMonth >= 3) return 10;
  if (recentMonth >= 1) return 6;
  return 0;
}

function scoreVariety(input: FosterScoreInput): number {
  const posts = input.contentPosts.filter((post) => post.petId === input.foster.id);
  const publications = input.publicationRecords.filter((record) => record.petId === input.foster.id);
  const manual = input.marketingActivities.filter((record) => record.petId === input.foster.id && record.source === 'manual');
  const types = new Set<string>();
  if (posts.some((post) => post.sourceType === 'photo' || post.primaryMediaId)) types.add('photo');
  if (posts.some((post) => post.sourceType === 'video' || post.contentType === 'Reel / TikTok Script')) types.add('video');
  if (posts.some((post) => post.contentType === 'Adoption Bio' || post.contentType === 'Petfinder / Rescue Listing' || post.contentType === 'Please Share Post')) types.add('adoption');
  if (posts.some((post) => post.contentType === 'Progress Update' || post.contentType === 'Funny Post' || post.contentType === 'Heartwarming Post')) types.add('story');
  const platforms = new Set([...publications.map((record) => record.platform), ...manual.map((record) => record.platform)]);
  let score = Math.min(types.size, 4) * 2;
  if (platforms.size >= 2) score += 2;
  return Math.min(score, 10);
}

export function calculateFosterFamousScore(input: FosterScoreInput): LiveFosterFamousScore {
  const now = input.now ?? new Date();
  const categories: FosterScoreCategory[] = [
    { key: 'profile', label: 'Profile', earned: scoreProfile(input.foster), possible: 20 },
    { key: 'photos', label: 'Photos', earned: scorePhotos(input), possible: 20 },
    { key: 'video', label: 'Video', earned: scoreVideo(input), possible: 15 },
    { key: 'bio', label: 'Adoption Bio', earned: scoreBio(input), possible: 15 },
    { key: 'activity', label: 'Posting Activity', earned: scoreActivity(input, now), possible: 20 },
    { key: 'variety', label: 'Marketing Variety', earned: scoreVariety(input), possible: 10 },
  ];
  const overall = categories.reduce((total, category) => total + category.earned, 0);
  const incomplete = [...categories].filter((category) => category.earned < category.possible);
  const opportunity = incomplete.sort((first, second) => (second.possible - second.earned) - (first.possible - first.earned) || first.key.localeCompare(second.key))[0];
  switch (opportunity?.key) {
    case 'profile':
      return { overall, categories, biggestOpportunity: 'Fill in a few useful profile details.', destination: 'profile', destinationParams: {} };
    case 'photos':
      return { overall, categories, biggestOpportunity: 'Add a clear full-body or everyday-life photo.', destination: 'photo-coach', destinationParams: { goalId: 'full-body' } };
    case 'video':
      return { overall, categories, biggestOpportunity: 'Add a short personality video.', destination: 'video-coach', destinationParams: {} };
    case 'bio':
      return { overall, categories, biggestOpportunity: 'Your adoption bio needs current information.', destination: 'adoption-bio', destinationParams: {} };
    case 'activity':
      return { overall, categories, biggestOpportunity: 'Share an adoption-focused post when you are ready.', destination: 'post-builder', destinationParams: { kind: 'Social Media Post', context: 'Create an accurate adoption-focused post using saved foster information only.' } };
    case 'variety':
      return { overall, categories, biggestOpportunity: 'Try a new accurate content angle or audience.', destination: 'post-builder', destinationParams: { kind: 'Social Media Post', context: 'Create an accurate fresh content angle using saved foster information only.' } };
    default:
      return { overall, categories, biggestOpportunity: 'Your key marketing pieces are in place.', destination: 'post-builder', destinationParams: { kind: 'Social Media Post', context: 'Create an accurate, fresh post when it feels useful.' } };
  }
}
