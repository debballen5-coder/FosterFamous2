import type { ContentPost } from './types';

/**
 * Content posts retain one primary attachment for legacy drafts and one-file
 * operating-system share handoffs. Photo posts may also retain every selected
 * library item in `mediaIds`.
 */
export function contentPostMediaIds(
  post: Pick<ContentPost, 'primaryMediaId' | 'mediaIds'> | null | undefined
): string[] {
  if (!post) return [];
  return [...new Set([
    post.primaryMediaId,
    ...(Array.isArray(post.mediaIds) ? post.mediaIds : []),
  ].filter((id): id is string => typeof id === 'string' && id.length > 0))];
}

/** Keeps the primary attachment aligned with a unique ordered attachment list. */
export function normalizeContentPostMedia(
  mediaIds: readonly string[] | null | undefined,
  primaryMediaId?: string | null
): { mediaIds: string[]; primaryMediaId: string | null } {
  const ids = [...new Set([
    primaryMediaId,
    ...(Array.isArray(mediaIds) ? mediaIds : []),
  ].filter((id): id is string => typeof id === 'string' && id.length > 0))];

  return { mediaIds: ids, primaryMediaId: ids[0] ?? null };
}
