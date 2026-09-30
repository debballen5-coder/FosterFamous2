import type { CoachMediaType, MediaCategoryTag, SpecialPromptKey } from './types';

/** Onboarding: what the foster parent wants help with. */
export const HELP_TOPICS: readonly string[] = [
  'I never know what to post',
  'I need better photos',
  'I need help writing captions',
  'I need help writing adoption bios',
  'My foster is getting little interest',
  'I want a simple promotion routine',
  'I want to track what is working',
];

export const PERSONALITY_TRAITS: readonly string[] = [
  'Cuddly',
  'Playful',
  'Gentle',
  'Goofy',
  'Adventurous',
  'Curious',
  'Independent',
  'Calm',
  'Affectionate',
  'Smart',
  'Food Motivated',
  'Toy Obsessed',
  'Couch Potato',
  'Shy at First',
  'Confident',
  'Social',
  'Loyal',
  'Silly',
];

export const CONSIDERATIONS: readonly string[] = [
  'Shy',
  'Senior',
  'Medical Needs',
  'Special Needs',
  'High Energy',
  'Only Pet',
  'Bonded Pair',
  'Long-Stay Foster',
  'Needs Experienced Adopter',
  'Difficult to Photograph',
  'Limited Applications',
  'No Applications',
  'Behavior Considerations',
  'Other',
];

export const SPECIAL_PROMPTS: readonly { key: SpecialPromptKey; label: string; hint: string }[] = [
  { key: 'favoriteActivity', label: 'Favorite activity', hint: 'Fetch, sunbeam naps, car rides…' },
  { key: 'favoriteToy', label: 'Favorite toy', hint: 'The one they always bring back' },
  { key: 'favoriteTreat', label: 'Favorite treat', hint: 'What gets instant attention' },
  { key: 'funniestHabit', label: 'Funniest habit', hint: 'The thing only you have noticed' },
  { key: 'bestSkill', label: 'Best skill', hint: 'Sit, leash manners, litter box champion…' },
  { key: 'mostLovableQuality', label: 'Most lovable quality', hint: 'Why you will miss them' },
  { key: 'makesYouLaugh', label: 'What makes you laugh?', hint: 'A tiny story works best' },
  { key: 'progressMade', label: 'What progress have they made?', hint: 'Then vs. now' },
  { key: 'idealHome', label: 'What type of home would suit them best?', hint: 'Be honest, not ideal' },
];

export interface MediaCategoryOption {
  id: MediaCategoryTag;
  label: string;
  mediaTypes: readonly CoachMediaType[];
}

/** Shared tags used by the media library, coach goals, and future filters. */
export const MEDIA_CATEGORY_TAGS: readonly MediaCategoryOption[] = [
  { id: 'profile', label: 'Profile photo', mediaTypes: ['photo'] },
  { id: 'face', label: 'Face close-up', mediaTypes: ['photo'] },
  { id: 'full-body', label: 'Full body', mediaTypes: ['photo'] },
  { id: 'portrait', label: 'Eye-level portrait', mediaTypes: ['photo'] },
  { id: 'play', label: 'Playing', mediaTypes: ['photo', 'video'] },
  { id: 'sleep', label: 'Sleeping', mediaTypes: ['photo'] },
  { id: 'walk', label: 'Walking', mediaTypes: ['photo', 'video'] },
  { id: 'toy', label: 'Favorite toy', mediaTypes: ['photo', 'video'] },
  { id: 'person-scale', label: 'With person for scale', mediaTypes: ['photo'] },
  { id: 'training', label: 'Training skill', mediaTypes: ['photo', 'video'] },
  { id: 'outdoors', label: 'Outdoors', mediaTypes: ['photo'] },
  { id: 'indoors', label: 'Relaxing indoors', mediaTypes: ['photo'] },
  { id: 'funny', label: 'Funny moment', mediaTypes: ['photo', 'video'] },
  { id: 'adoption', label: 'Adoption gear', mediaTypes: ['photo'] },
  { id: 'seasonal', label: 'Seasonal', mediaTypes: ['photo'] },
  { id: 'progress', label: 'Progress photo', mediaTypes: ['photo'] },
  { id: 'calm', label: 'Calm moment', mediaTypes: ['photo', 'video'] },
  { id: 'cuddling', label: 'Cuddling', mediaTypes: ['photo', 'video'] },
  { id: 'action', label: 'Action shot', mediaTypes: ['photo'] },
  { id: 'hero', label: 'Hero adoption photo', mediaTypes: ['photo'] },
  { id: 'greeting', label: 'Greeting foster parent', mediaTypes: ['video'] },
  { id: 'treat', label: 'Treat reaction', mediaTypes: ['video'] },
  { id: 'exploring', label: 'Exploring', mediaTypes: ['video'] },
  { id: 'day-in-life', label: 'Day in the Life', mediaTypes: ['video'] },
  { id: 'event', label: 'Adoption event', mediaTypes: ['photo', 'video'] },
  { id: 'success-story', label: 'Success story', mediaTypes: ['photo'] },
  { id: 'other', label: 'Other', mediaTypes: ['photo', 'video'] },
];

export interface CoachGoalOption {
  id: string;
  label: string;
  suggestedTag: MediaCategoryTag;
}

/** Photo Coach — stable IDs keep persisted progress safe if labels change. */
export const PHOTO_COACH_GOALS: readonly CoachGoalOption[] = [
  { id: 'face-close-up', label: 'Face close-up', suggestedTag: 'face' },
  { id: 'full-body', label: 'Full body', suggestedTag: 'full-body' },
  { id: 'eye-level-portrait', label: 'Eye-level portrait', suggestedTag: 'portrait' },
  { id: 'playing', label: 'Playing', suggestedTag: 'play' },
  { id: 'sleeping', label: 'Sleeping', suggestedTag: 'sleep' },
  { id: 'walking', label: 'Walking', suggestedTag: 'walk' },
  { id: 'favorite-toy', label: 'Favorite toy', suggestedTag: 'toy' },
  { id: 'person-for-scale', label: 'With person for scale', suggestedTag: 'person-scale' },
  { id: 'training-skill', label: 'Training skill', suggestedTag: 'training' },
  { id: 'outdoors', label: 'Outdoors', suggestedTag: 'outdoors' },
  { id: 'relaxing-indoors', label: 'Relaxing indoors', suggestedTag: 'indoors' },
  { id: 'funny-expression', label: 'Funny expression', suggestedTag: 'funny' },
  { id: 'adoption-gear', label: 'Adoption gear', suggestedTag: 'adoption' },
  { id: 'seasonal', label: 'Seasonal', suggestedTag: 'seasonal' },
  { id: 'progress-photo', label: 'Progress photo', suggestedTag: 'progress' },
  { id: 'calm-moment', label: 'Calm moment', suggestedTag: 'calm' },
  { id: 'cuddling', label: 'Cuddling', suggestedTag: 'cuddling' },
  { id: 'action-shot', label: 'Action shot', suggestedTag: 'action' },
  { id: 'profile-photo', label: 'Profile photo', suggestedTag: 'profile' },
  { id: 'hero-adoption-photo', label: 'Hero adoption photo', suggestedTag: 'hero' },
];

export const VIDEO_COACH_GOALS: readonly CoachGoalOption[] = [
  { id: 'play-clip', label: 'Play clip', suggestedTag: 'play' },
  { id: 'walking', label: 'Walking', suggestedTag: 'walk' },
  { id: 'greeting-foster-parent', label: 'Greeting foster parent', suggestedTag: 'greeting' },
  { id: 'training', label: 'Training', suggestedTag: 'training' },
  { id: 'favorite-toy', label: 'Favorite toy', suggestedTag: 'toy' },
  { id: 'calm-cuddle', label: 'Calm cuddle', suggestedTag: 'cuddling' },
  { id: 'treat-reaction', label: 'Treat reaction', suggestedTag: 'treat' },
  { id: 'exploring', label: 'Exploring', suggestedTag: 'exploring' },
  { id: 'day-in-the-life', label: 'Day in the Life', suggestedTag: 'day-in-life' },
  { id: 'funny-habit', label: 'Funny habit', suggestedTag: 'funny' },
  { id: 'adoption-event-clip', label: 'Adoption-event clip', suggestedTag: 'event' },
];

/** Label arrays retained for existing coach screens. */
export const PHOTO_CHECKLIST: readonly string[] = PHOTO_COACH_GOALS.map((goal) => goal.label);
export const VIDEO_CHECKLIST: readonly string[] = VIDEO_COACH_GOALS.map((goal) => goal.label);

export const CREATE_OPTIONS: readonly { title: string; blurb: string; icon: string }[] = [
  { title: 'Social Media Post', blurb: 'A solid all-purpose post', icon: 'sparkles' },
  { title: 'Facebook Post', blurb: 'Where most adopters still find pets', icon: 'facebook' },
  { title: 'Instagram Caption', blurb: 'Short, warm, and scroll-stopping', icon: 'instagram' },
  { title: 'Reel / TikTok Script', blurb: 'Hook, personality, adoption CTA', icon: 'video' },
  { title: 'Story Idea', blurb: 'Quick, casual, 24-hour posts', icon: 'circle' },
  { title: 'Adoption Bio', blurb: 'The listing that does the heavy lifting', icon: 'file' },
  { title: 'Petfinder / Rescue Listing', blurb: 'Formatted for adoption sites', icon: 'list' },
  { title: 'Local Community Post', blurb: 'Neighborhood groups and boards', icon: 'map' },
  { title: 'Adoption Event Post', blurb: 'Bring people to the meet-and-greet', icon: 'calendar' },
  { title: 'Please Share Post', blurb: 'A kind, direct ask for shares', icon: 'share' },
  { title: 'Progress Update', blurb: 'Then vs. now wins hearts', icon: 'trending' },
  { title: 'Funny Post', blurb: 'Let their goofy side out', icon: 'laugh' },
  { title: 'Heartwarming Post', blurb: 'The one people cry about', icon: 'heart' },
  { title: 'Urgent-but-Positive Post', blurb: 'Honest urgency, never guilt', icon: 'clock' },
  { title: 'Pet Point-of-View Post', blurb: 'Written in their own voice', icon: 'paw' },
];

export const HARD_TO_PLACE_CHALLENGES: readonly string[] = [
  'No Views',
  'Views but No Shares',
  'Shares but No Applications',
  'No Applications',
  'Shy Pet',
  'Senior Pet',
  'Medical Needs',
  'High Energy',
  'Only Pet',
  'Bonded Pair',
  'Long Stay',
  'Special Needs',
  'Hard to Photograph',
  'Unknown',
];

/** Legacy guidance retained for compatibility with existing challenge selections. */
export const CHALLENGE_HINTS: Record<string, string> = {
  'No Views':
    'Views are a posting-time and format problem, not a pet problem. We’ll walk you through the three highest-reach formats.',
  'Views but No Shares':
    'People share stories, not descriptions. We’ll help you rewrite the first line so it earns the share.',
  'Shares but No Applications':
    'Reach is working — the ask isn’t. We’ll tighten your call to action and adoption link.',
  'No Applications':
    'We’ll audit your photos, bio, and posting rhythm and give you the one change to make first.',
  'Shy Pet':
    'Shy pets need calm, quiet footage and honest framing. We’ll show you how to film without pushing them.',
  'Senior Pet':
    'Senior campaigns lean on dignity and routine. We’ll help you tell the “easy companion” story.',
  'Medical Needs':
    'Clear, accurate medical framing builds trust. We never hide or soften a diagnosis.',
  'High Energy':
    'High energy sells to the right home. We’ll help you name that home out loud.',
  'Only Pet':
    'Only-pet fosters need targeted posts. We’ll help you reach solo-pet households.',
  'Bonded Pair':
    'Pairs need a “two hearts, one home” story plus a practical case for the adopter.',
  'Long Stay':
    'Long stays need fresh angles, not louder pleas. We’ll rotate your content types.',
  'Special Needs':
    'We’ll help you describe care needs plainly so the right adopter self-selects.',
  'Hard to Photograph':
    'Black coats, wigglers, and hiders all have fixes. Photo Coach has a setup for each.',
  Unknown:
    'Start with a full profile and photo audit — that’s where most stalled campaigns are stuck.',
};

export const RESOURCE_LIBRARY: readonly { title: string; blurb: string }[] = [
  { title: 'Photo Tips', blurb: 'Light, angles, and 20 photo goals' },
  { title: 'Video Tips', blurb: 'Short clips that show real personality' },
  { title: 'Facebook Tips', blurb: 'Clear local sharing and calls to action' },
  { title: 'Instagram Tips', blurb: 'Captions, Reels, and realistic consistency' },
  { title: 'TikTok Tips', blurb: 'Quick hooks and truthful adoption details' },
  { title: 'Adoption Listings', blurb: 'Accurate, readable next steps for adopters' },
  { title: 'Captions & Bios', blurb: 'Specific stories and honest phrasing' },
  { title: 'Search & Hashtags', blurb: 'Relevant terms without ranking promises' },
  { title: 'Creative Promotion', blurb: 'Local, event, and community ideas' },
  { title: 'Common Mistakes', blurb: 'A practical pre-posting review' },
  { title: 'Safety & Accuracy', blurb: 'Protect fosters with truthful information' },
];

export const SETTINGS_ITEMS: readonly { title: string; blurb: string }[] = [
  { title: 'Foster Preferences', blurb: 'Dogs, cats, or both' },
  { title: 'Rescue Information', blurb: 'Defaults for new foster profiles' },
  { title: 'Help & FAQ', blurb: 'Answers for drafts, sharing, and foster care' },
  { title: 'Contact Support', blurb: 'Get help with Foster Famous' },
  { title: 'Privacy Policy', blurb: 'How your app data is handled' },
  { title: 'Terms of Use', blurb: 'Plain-language app terms' },
  { title: 'About Foster Famous', blurb: 'App purpose and version' },
];
