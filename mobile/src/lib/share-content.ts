import type { ContentPost, Foster } from './types';

export const SHARE_PLATFORMS = [
  'Facebook',
  'Instagram',
  'TikTok',
  'Facebook Group',
  'Instagram Story',
  'Nextdoor',
  'Other',
] as const;

export type SharePlatform = (typeof SHARE_PLATFORMS)[number];

export interface PreparedShareContent {
  platform: SharePlatform;
  title: string;
  caption: string;
  callToAction: string;
  hashtags: string[];
  adoptionLink: string | null;
  overlayText: string | null;
  shareText: string;
}

function trimmedLines(parts: readonly (string | null | undefined)[]): string[] {
  return parts.map((part) => part?.trim() ?? '').filter(Boolean);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Returns only the caption field for clipboard and share use. Older drafts and
 * provider output can sometimes repeat the hook, CTA, or tags inside caption;
 * those belong to their own controls and must not leak into a Caption-only copy.
 */
export function captionOnlyText(
  content: Pick<ContentPost, 'hook' | 'caption' | 'callToAction' | 'onScreenText' | 'hashtags'>
): string {
  const duplicateFields = [content.hook, content.callToAction, content.onScreenText]
    .map((value) => value.trim())
    .filter(Boolean);
  const structuredLabel = /^(?:hook|caption|call\s*to\s*action|cta|hashtags?|keywords?|on[-\s]?screen\s*text)\s*:\s*/i;

  const cleanLines = content.caption
    .split(/\r?\n/)
    .map((line) => {
      let value = line.trim().replace(structuredLabel, '');
      for (const duplicate of duplicateFields) {
        value = value.replace(new RegExp(escapeRegExp(duplicate), 'gi'), '').trim();
      }
      return value.replace(/(?:^|\s)#[\p{L}\p{N}_]+/gu, '').replace(/\s{2,}/g, ' ').trim();
    })
    .filter(Boolean);

  return normalizeCaptionFormatting(cleanLines.join('\n')).trim();
}

/** Keeps saved legacy captions readable when structured labels were stored inline. */
export function normalizeCaptionFormatting(text: string): string {
  const labels = '(?:Adoption status|Important considerations|Compatibility|Ideal home|Contact)';
  return text
    .trim()
    .replace(new RegExp(`[ \\t]+(?=${labels}:)`, 'gi'), '\n\n')
    .replace(/\n{3,}/g, '\n\n');
}

function relevantHashtags(post: ContentPost, limit?: number): string[] {
  const unique = [...new Set(post.hashtags.map((tag) => tag.trim()).filter(Boolean))];
  return typeof limit === 'number' ? unique.slice(0, limit) : unique;
}

function platformUsesAdoptionLink(platform: SharePlatform): boolean {
  return platform === 'Facebook' || platform === 'Facebook Group' || platform === 'Nextdoor';
}

/**
 * Prepares existing reviewed content for a destination without asking the AI to
 * make new claims. Private media notes and foster-profile internals are never
 * included here.
 */
export function prepareShareContent(
  post: ContentPost,
  foster: Foster,
  platform: SharePlatform
): PreparedShareContent {
  const adoptionLink = foster.adoptionUrl.trim() || null;
  const title = post.hook.trim() || `Meet ${foster.name}`;
  const callToAction = post.callToAction.trim();
  const isShortVideo = post.contentType === 'Reel / TikTok Script';

  if (platform === 'Instagram Story') {
    const overlayText = post.onScreenText.trim() || title;
    const caption = trimmedLines([overlayText, callToAction]).join('\n\n');
    return {
      platform,
      title,
      caption: normalizeCaptionFormatting(caption),
      callToAction,
      hashtags: [],
      adoptionLink: null,
      overlayText,
      shareText: caption,
    };
  }

  const hashtags =
    platform === 'Instagram'
      ? relevantHashtags(post, 5)
      : platform === 'TikTok'
        ? relevantHashtags(post, 5)
        : relevantHashtags(post);
  const caption =
    platform === 'TikTok' && isShortVideo
      ? post.shortVersion.trim() || captionOnlyText(post)
      : captionOnlyText(post);
  const link = platformUsesAdoptionLink(platform) ? adoptionLink : null;
  const formattedCaption = normalizeCaptionFormatting(caption);
  const shareText = trimmedLines([title, formattedCaption, callToAction, hashtags.join(' '), link]).join('\n\n');

  return {
    platform,
    title,
    caption: formattedCaption,
    callToAction,
    hashtags,
    adoptionLink: link,
    overlayText: null,
    shareText,
  };
}

export function fullPostText(post: ContentPost, foster?: Foster): string {
  const adoptionLink = foster?.adoptionUrl.trim() || null;
  return trimmedLines([
    post.hook,
    captionOnlyText(post),
    post.callToAction,
    post.onScreenText ? `On-screen text: ${post.onScreenText}` : null,
    post.hashtags.join(' '),
    adoptionLink,
  ]).join('\n\n');
}

export function prioritizedPlatforms(post: ContentPost): readonly SharePlatform[] {
  if (post.contentType === 'Reel / TikTok Script') {
    return ['TikTok', 'Instagram', 'Facebook', 'Other'];
  }
  if (post.contentType === 'Story Idea') {
    return ['Instagram Story', 'Instagram', 'Facebook', 'Other'];
  }
  if (post.contentType === 'Adoption Bio' || post.contentType === 'Petfinder / Rescue Listing') {
    return ['Facebook', 'Facebook Group', 'Nextdoor', 'Other'];
  }
  return SHARE_PLATFORMS;
}
