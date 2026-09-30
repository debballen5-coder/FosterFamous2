import type {
  AdoptionStatus,
  Compatibility,
  Foster,
  PlanDay,
  SpecialPromptKey,
} from './types';

/**
 * Built-in sample content. Everything here is clearly labelled as a SAMPLE in
 * the UI (see <DemoBadge />) so a foster parent never mistakes Winston for
 * their own pet or saves demo values onto a real foster.
 */

export const DEMO_FOSTER_ID = 'demo-winston';

export const WINSTON: Foster = {
  id: DEMO_FOSTER_ID,
  isDemo: true,

  name: 'Winston',
  species: 'dog',
  sex: 'Male',
  age: '3 years',
  breed: 'Mixed Breed',
  weight: '46 lbs',
  size: 'Medium',
  fosterStartDate: null,
  daysInFoster: 18,
  photoUri:
    'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=1200&q=80',

  personality: ['Goofy', 'Affectionate', 'Playful', 'Adventurous'],
  personalityNotes: 'Leans his whole body against you the second you sit down.',

  goodWithDogs: 'Yes',
  goodWithCats: 'Unknown',
  goodWithChildren: 'Still evaluating',
  childrenNotes: 'Calm with the neighbour’s 10-year-old. No experience with toddlers yet.',
  houseTrained: 'Yes',
  crateTrained: 'Still evaluating',
  energyLevel: 'Moderate',

  special: {
    favoriteActivity: 'Playing fetch until the tennis ball gives up',
    favoriteToy: 'A squeaky yellow tennis ball',
    favoriteTreat: 'Freeze-dried chicken',
    funniestHabit: 'Sighs dramatically when you stop petting him',
    bestSkill: 'A rock-solid sit before every meal',
    mostLovableQuality: 'He watches you like you are the best thing he has ever seen',
    makesYouLaugh: 'He carries his blanket from room to room like luggage',
    progressMade: 'Went from pacing at night to sleeping through it in two weeks',
    idealHome: 'A family who likes long walks and a dog that follows them everywhere',
  } satisfies Record<SpecialPromptKey, string>,

  rescueName: 'Second Chance Rescue',
  city: 'Asheville',
  state: 'NC',
  adoptionUrl: 'secondchancerescue.org/winston',
  contactMethod: 'Email the rescue',
  adoptionFee: '$250',
  adoptionStatus: 'Available' as AdoptionStatus,

  considerations: ['High Energy', 'Limited Applications'],

  score: {
    overall: 72,
    profileComplete: 100,
    photoLibrary: 65,
    videoLibrary: 40,
    adoptionBio: 100,
    postingConsistency: 55,
  },
};

/** A second sample so the Fosters list shows a real-feeling stack of cards. */
export const MARIGOLD: Foster = {
  ...WINSTON,
  id: 'demo-marigold',
  name: 'Marigold',
  species: 'cat',
  sex: 'Female',
  age: '2 years',
  breed: 'Domestic Shorthair',
  weight: '8 lbs',
  size: 'Small',
  daysInFoster: 41,
  photoUri:
    'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=1200&q=80',
  personality: ['Shy at First', 'Gentle', 'Curious', 'Couch Potato'],
  personalityNotes: 'Takes a week to warm up, then never leaves your lap.',
  goodWithDogs: 'Unknown' as Compatibility,
  goodWithCats: 'Yes' as Compatibility,
  goodWithChildren: 'Unknown' as Compatibility,
  childrenNotes: '',
  energyLevel: 'Low',
  adoptionStatus: 'Not Yet Available' as AdoptionStatus,
  considerations: ['Shy', 'Long-Stay Foster', 'Only Pet'],
  special: {
    ...WINSTON.special,
    favoriteActivity: 'Watching birds from the windowsill',
    favoriteToy: 'A crinkly paper ball',
    favoriteTreat: 'Lickable chicken puree',
    idealHome: 'A quiet home that will let her decide when to say hello',
  },
  score: {
    overall: 48,
    profileComplete: 80,
    photoLibrary: 45,
    videoLibrary: 15,
    adoptionBio: 60,
    postingConsistency: 40,
  },
};

export const DEMO_FOSTERS: readonly Foster[] = [WINSTON, MARIGOLD];

/** Today's suggested mission on the Home screen. */
export const DEMO_MISSION = {
  title: 'Show Winston’s playful side',
  body: 'Capture a 10–15 second video of Winston playing with his favorite toy.',
  formats: 'Reel • TikTok • Facebook Reel',
} as const;

export const DEMO_ALT_MISSIONS = [
  {
    title: 'The 3-second nap shot',
    body: 'Catch Winston mid-snooze. Sleepy photos get shared more than posed ones.',
    formats: 'Instagram Post • Facebook Post',
  },
  {
    title: 'Winston’s greeting',
    body: 'Film the moment you walk in the door. Show adopters what comes home to them.',
    formats: 'Reel • Story',
  },
  {
    title: 'One skill, one clip',
    body: 'Record his rock-solid sit before dinner. Adopters love a trainable dog.',
    formats: 'Reel • TikTok',
  },
] as const;

export const DEMO_PLAN: readonly PlanDay[] = [
  {
    day: 1,
    title: 'Meet Me',
    idea: 'Clear face photo + a warm two-line introduction',
    format: 'Photo Post',
    status: 'done',
  },
  {
    day: 2,
    title: 'Favorite Thing',
    idea: 'Favorite toy, treat, or activity in one honest shot',
    format: 'Photo Post',
    status: 'done',
  },
  {
    day: 3,
    title: 'Three Things About Me',
    idea: 'Three quick facts adopters actually want to know',
    format: 'Carousel • Short Reel',
    status: 'todo',
  },
  {
    day: 4,
    title: 'Funny Moment',
    idea: 'A candid photo or video of a habit that makes you laugh',
    format: 'Reel • TikTok',
    status: 'todo',
  },
  {
    day: 5,
    title: 'Foster Parent Says',
    idea: 'A short testimonial-style post in your own words',
    format: 'Text + Photo',
    status: 'todo',
  },
  {
    day: 6,
    title: 'A Day in the Life',
    idea: 'Four small clips: morning, walk, play, sleep',
    format: 'Reel',
    status: 'todo',
  },
  {
    day: 7,
    title: 'Please Share',
    idea: 'A direct, kind ask for shares with the adoption link',
    format: 'Facebook Post',
    status: 'todo',
  },
  {
    day: 8,
    title: 'Progress Update',
    idea: 'What has changed since week one',
    format: 'Photo + Caption',
    status: 'todo',
  },
  {
    day: 9,
    title: 'Pet Point-of-View',
    idea: 'Write the caption in their voice',
    format: 'Photo Post',
    status: 'todo',
  },
  {
    day: 10,
    title: 'Good With…',
    idea: 'Share only what you have actually observed',
    format: 'Photo Post',
    status: 'todo',
  },
];

export const DEMO_TRACKER_ROWS = [
  {
    date: 'Aug 21',
    platform: 'Facebook',
    contentType: 'Short Video',
    views: '4,120',
    shares: '38',
    inquiries: '6',
    applications: '2',
  },
  {
    date: 'Aug 19',
    platform: 'Instagram',
    contentType: 'Carousel',
    views: '1,860',
    shares: '11',
    inquiries: '2',
    applications: '0',
  },
  {
    date: 'Aug 17',
    platform: 'TikTok',
    contentType: 'Reel',
    views: '9,430',
    shares: '64',
    inquiries: '4',
    applications: '1',
  },
  {
    date: 'Aug 15',
    platform: 'Facebook',
    contentType: 'Photo',
    views: '980',
    shares: '5',
    inquiries: '1',
    applications: '0',
  },
];
