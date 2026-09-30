import type { ContentPost, Foster, FosterProgressUpdate } from './types';

/**
 * Current information is intentionally kept separate from the chronological
 * progress timeline. Generation uses the current status and newest milestone,
 * never prior drafts as factual input.
 */
export function latestProgressUpdate(foster: Foster): FosterProgressUpdate | null {
  const updates = foster.progressUpdates ?? [];
  if (updates.length === 0) {
    const legacySummary = foster.special.progressMade.trim();
    return legacySummary
      ? {
          id: `legacy-progress-${foster.id}`,
          fosterId: foster.id,
          category: 'General Update',
          summary: legacySummary,
          occurredAt: '',
          createdAt: '',
        }
      : null;
  }

  return [...updates].sort((first, second) => {
    const firstDate = first.occurredAt || first.createdAt;
    const secondDate = second.occurredAt || second.createdAt;
    return secondDate.localeCompare(firstDate) || second.createdAt.localeCompare(first.createdAt);
  })[0] ?? null;
}

export function progressHistory(foster: Foster): readonly FosterProgressUpdate[] {
  const updates = (foster.progressUpdates ?? []).map((update) => ({
    ...update,
    category: update.category ?? 'General Update',
  }));
  const legacySummary = foster.special.progressMade.trim();
  if (legacySummary && !updates.some((update) => update.summary === legacySummary)) {
    updates.push({
      id: `legacy-progress-${foster.id}`,
      fosterId: foster.id,
      category: 'General Update',
      summary: legacySummary,
      occurredAt: '',
      createdAt: '',
    });
  }

  return updates.sort((first, second) => {
    const firstDate = first.occurredAt || first.createdAt;
    const secondDate = second.occurredAt || second.createdAt;
    return secondDate.localeCompare(firstDate) || second.createdAt.localeCompare(first.createdAt);
  });
}

export function isContentPostStale(post: ContentPost, foster: Foster): boolean {
  const currentRevision = foster.currentInfoUpdatedAt;
  if (!currentRevision) return false;
  const draftRevision = post.fosterInfoUpdatedAt ?? post.createdAt;
  return currentRevision > draftRevision;
}
