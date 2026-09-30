import type {
  AdoptionBoostTask,
  ContentPost,
  Foster,
  MarketingActivity,
  MediaItem,
  PublicationRecord,
} from './types';

export type FosterActivityKind =
  | 'post-published'
  | 'content-created'
  | 'content-updated'
  | 'media-added'
  | 'foster-update'
  | 'profile-updated'
  | 'boost-completed'
  | 'adopted'
  | 'reactivated'
  | 'marketing-activity';

export interface RecentFosterActivity {
  id: string;
  kind: FosterActivityKind;
  title: string;
  occurredAt: string;
}

export interface FosterActivitySources {
  contentPosts: readonly ContentPost[];
  publicationRecords: readonly PublicationRecord[];
  marketingActivities: readonly MarketingActivity[];
  mediaItems: readonly MediaItem[];
  adoptionBoostTasks: readonly AdoptionBoostTask[];
}

function timestamp(value: string | null | undefined): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function postLabel(post: ContentPost): string {
  return post.contentType === 'Adoption Bio' ? 'Adoption bio' : 'Social media post';
}

function taskLabel(task: AdoptionBoostTask): string {
  return task.taskType.replace(/-/g, ' ');
}

/**
 * Produces one chronological, meaningful activity stream from existing records.
 * It deliberately never turns generated text or a social post into Current
 * Status; placement remains the foster profile's adoptionStatus field.
 */
export function fosterActivityHistory(
  foster: Foster,
  sources: FosterActivitySources
): RecentFosterActivity[] {
  const activities: RecentFosterActivity[] = [];

  sources.publicationRecords
    .filter((record) => record.petId === foster.id)
    .forEach((record) => {
      activities.push({
        id: `publication-${record.id}`,
        kind: 'post-published',
        title: `${record.contentType === 'Adoption Bio' ? 'Adoption bio' : 'Social media post'} published`,
        occurredAt: record.postedAt,
      });
    });

  sources.contentPosts
    .filter((post) => post.petId === foster.id)
    .forEach((post) => {
      const isNew = timestamp(post.createdAt) === timestamp(post.updatedAt);
      activities.push({
        id: `content-${post.id}-${isNew ? 'created' : 'updated'}`,
        kind: isNew ? 'content-created' : 'content-updated',
        title: `${postLabel(post)} ${isNew ? 'created' : 'updated'}`,
        occurredAt: isNew ? post.createdAt : post.updatedAt,
      });
    });

  sources.mediaItems
    .filter((media) => media.fosterId === foster.id && !media.deletedAt)
    .forEach((media) => {
      activities.push({
        id: `media-${media.id}`,
        kind: 'media-added',
        title: `New ${media.type} added`,
        occurredAt: media.createdAt,
      });
    });

  (foster.progressUpdates ?? []).forEach((update) => {
    activities.push({
      id: `update-${update.id}`,
      kind: 'foster-update',
      title: update.category === 'Adoption Status' ? 'Placement status updated' : 'Foster update recorded',
      occurredAt: update.occurredAt || update.createdAt,
    });
  });

  sources.adoptionBoostTasks
    .filter((task) => task.petId === foster.id && task.status === 'Completed' && task.completedAt)
    .forEach((task) => {
      activities.push({
        id: `boost-${task.id}`,
        kind: 'boost-completed',
        title: `Adoption Boost activity completed: ${taskLabel(task)}`,
        occurredAt: task.completedAt ?? task.updatedAt,
      });
    });

  sources.marketingActivities
    .filter((activity) => activity.petId === foster.id)
    .forEach((activity) => {
      activities.push({
        id: `marketing-${activity.id}`,
        kind: 'marketing-activity',
        title: activity.summary || 'Marketing activity recorded',
        occurredAt: activity.occurredAt,
      });
    });

  const adoptedPeriod = [...(foster.fosterPeriods ?? [])]
    .reverse()
    .find((period) => period.status === 'Adopted' && period.endedAt);
  if (adoptedPeriod?.endedAt) {
    activities.push({
      id: `adopted-${adoptedPeriod.id}`,
      kind: 'adopted',
      title: 'Adoption marked',
      occurredAt: adoptedPeriod.endedAt,
    });
  }

  const activePeriod = [...(foster.fosterPeriods ?? [])]
    .reverse()
    .find((period) => period.status === 'Active' && !period.endedAt);
  if (activePeriod && adoptedPeriod && timestamp(activePeriod.startedAt) > timestamp(adoptedPeriod.endedAt)) {
    activities.push({
      id: `reactivated-${activePeriod.id}`,
      kind: 'reactivated',
      title: 'Foster reactivated after return',
      occurredAt: activePeriod.startedAt ?? '',
    });
  }

  // This is a factual profile revision, not the profile's creation event.
  if (foster.currentInfoUpdatedAt) {
    activities.push({
      id: `profile-${foster.id}-${foster.currentInfoUpdatedAt}`,
      kind: 'profile-updated',
      title: 'Foster profile updated',
      occurredAt: foster.currentInfoUpdatedAt,
    });
  }

  return activities
    .filter((activity) => Number.isFinite(timestamp(activity.occurredAt)))
    .sort((first, second) => timestamp(second.occurredAt) - timestamp(first.occurredAt));
}

export function latestFosterActivity(
  foster: Foster,
  sources: FosterActivitySources
): RecentFosterActivity | null {
  return fosterActivityHistory(foster, sources)[0] ?? null;
}

export function formatActivityDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Earlier';
  if (date.toDateString() === new Date().toDateString()) return 'Today';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

