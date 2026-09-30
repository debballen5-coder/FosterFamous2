import { useMemo } from 'react';

import { latestFosterActivity, type RecentFosterActivity } from './foster-activity';
import { useAppStore } from './state/app-store';
import type { Foster } from './types';

/** Subscribes to the existing records that can contribute to recent activity. */
export function useRecentFosterActivity(foster: Foster): RecentFosterActivity | null {
  const contentPosts = useAppStore((state) => state.contentPosts);
  const publicationRecords = useAppStore((state) => state.publicationRecords);
  const marketingActivities = useAppStore((state) => state.marketingActivities);
  const mediaItems = useAppStore((state) => state.mediaItems);
  const adoptionBoostTasks = useAppStore((state) => state.adoptionBoostTasks);

  return useMemo(
    () =>
      latestFosterActivity(foster, {
        contentPosts,
        publicationRecords,
        marketingActivities,
        mediaItems,
        adoptionBoostTasks,
      }),
    [adoptionBoostTasks, contentPosts, foster, marketingActivities, mediaItems, publicationRecords]
  );
}
