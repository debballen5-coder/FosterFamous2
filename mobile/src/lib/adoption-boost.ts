import { VIDEO_COACH_GOALS } from './options';
import { latestProgressUpdate } from './foster-current-info';
import type {
  AdoptionBoostCategory,
  AdoptionBoostDestination,
  AdoptionBoostPriority,
  AdoptionBoostRecommendation,
  AdoptionBoostTaskType,
  CoachGoalRecord,
  ContentPost,
  Foster,
  MediaItem,
  PublicationRecord,
} from './types';

export interface AdoptionBoostInput {
  foster: Foster;
  daysInFoster: number;
  mediaItems: readonly MediaItem[];
  coachGoals: readonly CoachGoalRecord[];
  contentPosts: readonly ContentPost[];
  publicationRecords: readonly PublicationRecord[];
  dismissedCategories?: readonly AdoptionBoostCategory[];
  now?: Date;
}

type Candidate = Omit<AdoptionBoostRecommendation, 'id' | 'petId' | 'generatedAt' | 'dateKey'> & {
  rank: number;
};

const PRIORITY_RANK: Record<AdoptionBoostPriority, number> = {
  critical: 400,
  high: 300,
  medium: 200,
  maintenance: 100,
};

function dayKey(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function isCompleted(
  records: readonly CoachGoalRecord[],
  fosterId: string,
  mediaType: 'photo' | 'video',
  goalId: string
): boolean {
  const record = records.find(
    (item) => item.fosterId === fosterId && item.mediaType === mediaType && item.goalId === goalId
  );
  return Boolean(record?.manuallyCompleted || (record?.mediaIds.length ?? 0) > 0);
}

function addCandidate(
  candidates: Candidate[],
  candidate: Omit<Candidate, 'rank'>
): void {
  if (candidates.some((item) => item.category === candidate.category)) return;
  candidates.push({ ...candidate, rank: PRIORITY_RANK[candidate.priority] });
}

function contentContext(foster: Foster, detail: string): Record<string, string> {
  return { context: `${detail}\nUse only the facts already saved for ${foster.name}.` };
}

function isVideoPost(post: ContentPost): boolean {
  return post.contentType === 'Reel / TikTok Script' || post.sourceType === 'video';
}

function hasContent(posts: readonly ContentPost[], type: ContentPost['contentType']): boolean {
  return posts.some((post) => post.contentType === type);
}

export function buildAdoptionBoostRecommendations(input: AdoptionBoostInput): AdoptionBoostRecommendation[] {
  const { foster, daysInFoster } = input;
  if (foster.adoptionStatus === 'Adopted') return [];
  const now = input.now ?? new Date();
  const dateKeyValue = dayKey(now);
  const candidates: Candidate[] = [];
  const posts = input.contentPosts.filter((post) => post.petId === foster.id);
  const publications = input.publicationRecords.filter((record) => record.petId === foster.id);
  const media = input.mediaItems.filter((item) => item.fosterId === foster.id && !item.deletedAt);
  const photos = media.filter((item) => item.type === 'photo');
  const videos = media.filter((item) => item.type === 'video');
  const photoPosts = publications.filter((record) => !isVideoPost(posts.find((post) => post.id === record.contentPostId) ?? ({ sourceType: 'photo', contentType: record.contentType } as ContentPost)));
  const videoPosts = publications.filter((record) => {
    const post = posts.find((item) => item.id === record.contentPostId);
    return post ? isVideoPost(post) : record.contentType === 'Reel / TikTok Script';
  });
  const lastPublication = publications
    .map((record) => new Date(record.postedAt))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const daysSincePost = lastPublication
    ? Math.floor((now.getTime() - lastPublication.getTime()) / 86_400_000)
    : null;
  const hasBio = hasContent(posts, 'Adoption Bio') || hasContent(posts, 'Petfinder / Rescue Listing');
  const hasHero = isCompleted(input.coachGoals, foster.id, 'photo', 'hero-adoption-photo') || photos.some((item) => item.tags.includes('hero'));
  const videoCoachComplete = VIDEO_COACH_GOALS.some((goal) => isCompleted(input.coachGoals, foster.id, 'video', goal.id));
  const currentProgress = latestProgressUpdate(foster)?.summary.trim() ?? '';
  const favoriteActivity = foster.special.favoriteActivity.trim();
  const isShy = foster.considerations.some((item) => item.toLowerCase() === 'shy');
  const isHighEnergy = foster.considerations.some((item) => item.toLowerCase() === 'high energy');
  const hasRecentProgressPost = posts.some(
    (post) => post.contentType === 'Progress Update' && currentProgress && post.sourceDescription.includes(currentProgress)
  );

  if (!foster.photoUri) {
    addCandidate(candidates, {
      category: 'add-profile-photo', priority: 'critical', title: `Give ${foster.name} a face`,
      explanation: `Add a clear profile photo so ${foster.name} is easy to recognize throughout Foster Famous.`,
      suggestedAction: 'Add Profile Photo', destination: 'profile-photo', destinationParams: {},
      sourceReason: ['profile photo = missing'],
    });
  }

  if (!foster.rescueName.trim() && !foster.contactMethod.trim() && !foster.adoptionUrl.trim()) {
    addCandidate(candidates, {
      category: 'add-adoption-info', priority: 'critical', title: 'Make the next step easy',
      explanation: `Add rescue or contact details so future posts for ${foster.name} can include a clear, accurate next step.`,
      suggestedAction: 'Add Adoption Info', destination: 'profile-adoption', destinationParams: {},
      sourceReason: ['rescue name = missing', 'contact method = missing', 'adoption URL = missing'],
    });
  }

  if (foster.personality.length === 0 && !foster.personalityNotes.trim()) {
    addCandidate(candidates, {
      category: 'update-personality', priority: 'critical', title: `Tell people who ${foster.name} really is`,
      explanation: 'Add a few personality details so Foster Famous can help create more personal, accurate posts.',
      suggestedAction: 'Update Personality', destination: 'profile-personality', destinationParams: {},
      sourceReason: ['personality traits = none', 'personality notes = missing'],
    });
  }

  if (!hasBio) {
    addCandidate(candidates, {
      category: 'create-adoption-bio', priority: 'high', title: `Give ${foster.name} a strong adoption bio`,
      explanation: 'A good bio gives potential adopters a quick picture of personality, lifestyle, and an ideal home.',
      suggestedAction: 'Create Adoption Bio', destination: 'adoption-bio', destinationParams: {},
      sourceReason: ['saved adoption bio = none'],
    });
  }

  if (photos.length < 2) {
    addCandidate(candidates, {
      category: 'new-photo', priority: 'medium', title: `Build ${foster.name}’s photo library`,
      explanation: 'Capture a few different sides of their personality today so you have fresh, honest moments ready to use.',
      suggestedAction: 'Open Photo Coach', destination: 'photo-coach', destinationParams: {},
      sourceReason: [`saved photos = ${photos.length}`],
    });
  }

  if (isShy && photos.length >= 2) {
    addCandidate(candidates, {
      category: 'personality-photo', priority: 'medium', title: `Show ${foster.name}'s quiet side`,
      explanation: `${foster.name}'s saved profile notes that they are shy. A calm, honest moment can help people see their real personality without pushing them.`,
      suggestedAction: 'See Photo Idea', destination: 'photo-coach', destinationParams: { goalId: 'calm-moment' },
      sourceReason: ['saved consideration = Shy', `saved photos = ${photos.length}`],
    });
  }

  if (!hasHero) {
    addCandidate(candidates, {
      category: 'hero-photo', priority: daysInFoster >= 22 ? 'high' : 'medium', title: 'Get the photo that stops the scroll',
      explanation: `Capture a clean, eye-level hero photo of ${foster.name} that can become a strong main adoption image.`,
      suggestedAction: 'Take Hero Photo', destination: 'photo-coach', destinationParams: { goalId: 'hero-adoption-photo' },
      sourceReason: ['Hero Adoption Photo = incomplete'],
    });
  }

  if (publications.length === 0) {
    addCandidate(candidates, {
      category: 'introduction-post', priority: 'high', title: `Introduce ${foster.name}`,
      explanation: `You have not confirmed a post for ${foster.name} yet. Start with one clear, welcoming introduction based on their saved profile.`,
      suggestedAction: 'Create Introduction Post', destination: 'post-builder', destinationParams: contentContext(foster, 'Create a warm introduction post.'),
      sourceReason: ['confirmed publications = 0'],
    });
  }

  if (photoPosts.length >= 2 && videoPosts.length === 0) {
    const activitySentence = favoriteActivity
      ? `Capture ${foster.name} ${favoriteActivity.toLowerCase()} in a natural 10–15 second clip.`
      : isHighEnergy
        ? `${foster.name}'s profile lists High Energy, so capture a natural 10–15 second action moment.`
        : `Capture ${foster.name} doing one of their favorite activities in a natural 10–15 second clip.`;
    addCandidate(candidates, {
      category: 'short-video', priority: 'high', title: `Let people see ${foster.name} in motion`,
      explanation: `${photoPosts.length} confirmed photo post${photoPosts.length === 1 ? '' : 's'} and no confirmed video post${videoCoachComplete || videos.length ? '' : ' or saved video'} are recorded yet. ${activitySentence}`,
      suggestedAction: 'Get a Video Idea', destination: 'video-coach', destinationParams: {},
      sourceReason: [`confirmed photo publications = ${photoPosts.length}`, `confirmed video publications = ${videoPosts.length}`, `saved videos = ${videos.length}`, `Video Coach complete = ${videoCoachComplete}`],
    });
  }

  if (currentProgress && !hasRecentProgressPost && !hasContent(posts, 'Progress Update')) {
    addCandidate(candidates, {
      category: 'progress-post', priority: 'medium', title: `Celebrate ${foster.name}’s progress`,
      explanation: 'You saved a milestone that has not been turned into a post yet. Let potential adopters see how they are growing.',
      suggestedAction: 'Create Progress Post', destination: 'post-builder', destinationParams: contentContext(foster, `Use this saved progress update: ${currentProgress}`),
      sourceReason: ['saved progress update = present', 'progress posts = none'],
    });
  }

  if (foster.special.idealHome.trim() && !hasContent(posts, 'Petfinder / Rescue Listing')) {
    addCandidate(candidates, {
      category: 'ideal-home-post', priority: 'medium', title: `Help people picture ${foster.name} in their home`,
      explanation: 'You have saved ideal-home information that can help the right family understand the lifestyle fit.',
      suggestedAction: 'Create Ideal Home Post', destination: 'post-builder', destinationParams: contentContext(foster, `Focus on this saved ideal-home detail: ${foster.special.idealHome.trim()}`),
      sourceReason: ['ideal home = present', 'ideal-home content = none'],
    });
  }

  if (foster.city.trim() && foster.state.trim() && (foster.rescueName.trim() || foster.contactMethod.trim() || foster.adoptionUrl.trim()) && !hasContent(posts, 'Local Community Post')) {
    addCandidate(candidates, {
      category: 'local-community-post', priority: daysInFoster >= 8 ? 'medium' : 'maintenance', title: `Help local adopters discover ${foster.name}`,
      explanation: `You have ${foster.name}’s city, state, and adoption details saved, but no Local Community Post has been created yet.`,
      suggestedAction: 'Create Local Post', destination: 'post-builder', destinationParams: contentContext(foster, 'Create a local-community post. Never include a foster-home address.'),
      sourceReason: ['city/state = present', 'adoption information = present', 'local community posts = none'],
    });
  }

  const confirmedPlatforms = [...new Set(publications.map((record) => record.platform))];
  if (daysInFoster >= 8 && publications.length > 0 && confirmedPlatforms.length === 1) {
    addCandidate(candidates, {
      category: 'platform-variety', priority: 'maintenance', title: 'Reach a different local audience',
      explanation: `You have confirmed sharing ${foster.name} on ${confirmedPlatforms[0]}. If another community already fits your routine, you could prepare a version to share there too.`,
      suggestedAction: 'Create Another Version', destination: 'post-builder', destinationParams: contentContext(foster, 'Create another accurate version for a community the foster parent already uses.'),
      sourceReason: [`confirmed platforms = ${confirmedPlatforms[0]}`],
    });
  }

  if (daysInFoster >= 22 && !hasContent(posts, 'Please Share Post')) {
    addCandidate(candidates, {
      category: 'please-share-post', priority: daysInFoster >= 46 ? 'high' : 'medium', title: 'Ask your network to help',
      explanation: `${foster.name} has been in foster for ${daysInFoster} days and there is no saved Please Share post yet. A fresh, kind share request can help more people discover their story.`,
      suggestedAction: 'Create Please Share Post', destination: 'post-builder', destinationParams: contentContext(foster, 'Create a kind, encouraging Please Share post without guilt-based wording.'),
      sourceReason: [`days in foster = ${daysInFoster}`, 'Please Share posts = none'],
    });
  }

  if (daysInFoster >= 46) {
    addCandidate(candidates, {
      category: 'seven-day-boost', priority: 'medium', title: 'Start a 7-Step Adoption Boost',
      explanation: `${foster.name} has been in foster for ${daysInFoster} days. A short, manageable week of fresh story angles can help renew visibility without adding pressure.`,
      suggestedAction: 'Start Adoption Boost', destination: 'campaign', destinationParams: {},
      sourceReason: [`days in foster = ${daysInFoster}`, 'long-stay stage = 46+ days'],
    });
  }

  if (publications.length > 0 && daysSincePost !== null && daysSincePost >= 6) {
    addCandidate(candidates, {
      category: 'prepare-content', priority: 'maintenance', title: `Prepare a fresh post for ${foster.name}`,
      explanation: `Your last confirmed promotion activity was ${daysSincePost} days ago. A simple new post can keep ${foster.name}'s story ready to share when the time feels right.`,
      suggestedAction: 'Create a Post', destination: 'post-builder', destinationParams: contentContext(foster, 'Create a fresh, accurate social post.'),
      sourceReason: [`days since confirmed promotion = ${daysSincePost}`],
    });
  }

  if (candidates.length === 0 || (daysSincePost !== null && daysSincePost < 2 && hasBio && hasHero && photos.length >= 2)) {
    addCandidate(candidates, {
      category: 'rest', priority: 'maintenance', title: "You're in good shape today 🐾",
      explanation: `You've already shared ${foster.name} recently and the key marketing pieces are in place. Want to prepare something for later?`,
      suggestedAction: "Get Tomorrow's Idea", destination: 'post-builder', destinationParams: contentContext(foster, 'Prepare a gentle, accurate post for a future share.'),
      sourceReason: ['recent confirmed promotion = yes', `saved photos = ${photos.length}`, `adoption bio = ${hasBio}`, `hero photo = ${hasHero}`],
    });
  }

  const dismissed = new Set(input.dismissedCategories ?? []);
  const available = candidates.filter((candidate) => !dismissed.has(candidate.category));
  const selected = available.length > 0 ? available : candidates;

  return selected
    .sort((a, b) => b.rank - a.rank || a.title.localeCompare(b.title))
    .map(({ rank: _rank, ...candidate }, index) => ({
      ...candidate,
      id: `boost-${foster.id}-${dateKeyValue}-${candidate.category}-${index}`,
      petId: foster.id,
      generatedAt: now.toISOString(),
      dateKey: dateKeyValue,
    }));
}

export const BOOST_TASKS: readonly {
  day: number;
  taskType: AdoptionBoostTaskType;
  title: string;
  description: string;
  actionLabel: string;
  destination: AdoptionBoostDestination;
  destinationParams: Record<string, string>;
}[] = [
  { day: 1, taskType: 'hero-photo', title: 'Refresh the Hero', description: 'Review or capture the strongest adoption photo.', actionLabel: 'Open Photo Coach', destination: 'photo-coach', destinationParams: { goalId: 'hero-adoption-photo' } },
  { day: 2, taskType: 'personality-post', title: 'Personality Post', description: 'Share something memorable and true about your foster.', actionLabel: 'Create Post', destination: 'post-builder', destinationParams: { kind: 'Heartwarming Post', context: 'Create a personality-focused post using only saved profile facts.' } },
  { day: 3, taskType: 'short-video', title: 'Short Video', description: 'Capture 10–15 seconds of personality in motion.', actionLabel: 'Open Video Coach', destination: 'video-coach', destinationParams: {} },
  { day: 4, taskType: 'ideal-home-post', title: 'Ideal Home', description: 'Explain what kind of home could be a good fit.', actionLabel: 'Create Post', destination: 'post-builder', destinationParams: { kind: 'Petfinder / Rescue Listing', context: 'Focus on saved ideal-home and compatibility facts. Keep unknown compatibility unknown.' } },
  { day: 5, taskType: 'progress-post', title: 'Progress or Favorite Thing', description: 'Show one real positive detail or milestone.', actionLabel: 'Create Post', destination: 'post-builder', destinationParams: { kind: 'Progress Update', context: 'Use only saved progress or favorite-activity details.' } },
  { day: 6, taskType: 'local-community-post', title: 'Local Share', description: 'Prepare a community-friendly post for local groups.', actionLabel: 'Create Local Post', destination: 'post-builder', destinationParams: { kind: 'Local Community Post', context: 'Never include a foster-home address.' } },
  { day: 7, taskType: 'please-share-post', title: 'Please Share', description: 'Ask the network to help reach the right adopter.', actionLabel: 'Create Please Share Post', destination: 'post-builder', destinationParams: { kind: 'Please Share Post', context: 'Use encouraging, never guilt-based wording.' } },
];
