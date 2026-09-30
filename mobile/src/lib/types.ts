/**
 * Foster Famous domain types.
 *
 * Foster information is stored locally on the device. Anything that could
 * become a positive claim about an animal is modelled as an
 * explicit tri-state (see `Compatibility`) rather than a boolean, so
 * "unknown" can never be collapsed into "no". See src/lib/content-rules.ts.
 */

export type Species = 'dog' | 'cat';
export type FosterPreference = 'dogs' | 'cats' | 'both';
export type Sex = 'Male' | 'Female' | 'Unknown';
export type PetSize = 'Small' | 'Medium' | 'Large' | 'Extra Large';

/** Never a boolean — unknown must stay unknown. */
export type Compatibility = 'Yes' | 'No' | 'Unknown' | 'Still evaluating';

export type EnergyLevel = 'Low' | 'Moderate' | 'High' | 'Very High';

/** The foster's verified placement. This is the sole source for Current Status. */
export type AdoptionStatus =
  | 'Not Yet Available'
  | 'Available'
  | 'Application Pending'
  | 'Meet-and-Greet Scheduled'
  | 'Adoption Pending'
  | 'Medical Hold'
  | 'Foster Hold'
  | 'Returned to Rescue/Shelter'
  | 'Adopted';

export const ADOPTION_STATUSES: readonly AdoptionStatus[] = [
  'Not Yet Available',
  'Available',
  'Application Pending',
  'Meet-and-Greet Scheduled',
  'Adoption Pending',
  'Medical Hold',
  'Foster Hold',
  'Returned to Rescue/Shelter',
  'Adopted',
];

export const COMPATIBILITY_OPTIONS: readonly Compatibility[] = [
  'Yes',
  'No',
  'Unknown',
  'Still evaluating',
];

export const ENERGY_LEVELS: readonly EnergyLevel[] = ['Low', 'Moderate', 'High', 'Very High'];

export interface FosterFamousScore {
  overall: number;
  profileComplete: number;
  photoLibrary: number;
  videoLibrary: number;
  adoptionBio: number;
  postingConsistency: number;
}

export type ProgressUpdateCategory =
  | 'Medical'
  | 'Training'
  | 'Behavior'
  | 'Compatibility'
  | 'Adoption Status'
  | 'Milestone'
  | 'General Update';

/** A foster-parent-recorded milestone. It is history, never a replacement for current status. */
export interface FosterProgressUpdate {
  id: string;
  fosterId: string;
  category: ProgressUpdateCategory;
  summary: string;
  occurredAt: string;
  createdAt: string;
}

/** One active or completed stay in foster care. Completed periods are never overwritten on a return. */
export interface FosterPeriod {
  id: string;
  /** The saved intake/start date for this specific period, if known. */
  startedAt: string | null;
  /** Set when this period ended in adoption; null while actively fostering. */
  endedAt: string | null;
  status: 'Active' | 'Adopted';
}

/** A durable adoption record linked to the completed foster period. */
export interface AdoptionEvent {
  id: string;
  fosterPeriodId: string;
  adoptedAt: string | null;
  createdAt: string;
}

export interface Foster {
  id: string;
  /** True for the built-in Winston sample. Demo fosters are read-only and
   *  clearly labelled so a new user never mistakes them for their own pet. */
  isDemo: boolean;

  // Step 1 — Meet Your Foster
  name: string;
  species: Species;
  sex: Sex;
  age: string;
  breed: string;
  weight: string;
  size: PetSize | null;
  fosterStartDate: string | null;
  /** Legacy fallback retained for demo and older profiles with no saved intake date. */
  daysInFoster: number;
  /** Completed adoption periods and the current active period, oldest first. */
  fosterPeriods?: FosterPeriod[];
  /** Adoption events remain separate from current placement so returns never erase history. */
  adoptionEvents?: AdoptionEvent[];
  photoUri: string | null;
  /** Media-library photo used after a successful adoption. Optional for v1 data. */
  successStoryPhotoMediaId?: string | null;

  // Step 2 — Personality
  personality: string[];
  personalityNotes: string;

  // Step 3 — Home Compatibility
  goodWithDogs: Compatibility;
  goodWithCats: Compatibility;
  goodWithChildren: Compatibility;
  childrenNotes: string;
  houseTrained: Compatibility;
  crateTrained: Compatibility;
  energyLevel: EnergyLevel | null;

  // Step 4 — What Makes Them Special
  special: Record<SpecialPromptKey, string>;

  // Step 5 — Adoption Information
  rescueName: string;
  rescueContactName?: string;
  city: string;
  state: string;
  adoptionUrl: string;
  adoptionEmail?: string;
  adoptionPhone?: string;
  adoptionInstructions?: string;
  /** A free-form contact summary retained for existing foster profiles. */
  contactMethod: string;
  adoptionFee: string;
  adoptionStatus: AdoptionStatus;

  // Step 6 — Challenges
  considerations: string[];

  /** The foster parent's current, verified status. This takes priority over progress history and drafts. */
  currentStatus?: string;
  /** Chronological foster-parent-recorded milestones, newest first when displayed. */
  progressUpdates?: FosterProgressUpdate[];
  /** Revised only when factual/profile information changes, never when a draft is edited. */
  currentInfoUpdatedAt?: string;

  score: FosterFamousScore;
}

export type SpecialPromptKey =
  | 'favoriteActivity'
  | 'favoriteToy'
  | 'favoriteTreat'
  | 'funniestHabit'
  | 'bestSkill'
  | 'mostLovableQuality'
  | 'makesYouLaugh'
  | 'progressMade'
  | 'idealHome';

export type MediaType = 'photo' | 'video';
export type MediaSource = 'camera' | 'library' | 'profile' | 'content-builder' | 'migration';

export type MediaCategoryTag =
  | 'profile'
  | 'face'
  | 'full-body'
  | 'portrait'
  | 'play'
  | 'sleep'
  | 'walk'
  | 'toy'
  | 'person-scale'
  | 'training'
  | 'outdoors'
  | 'indoors'
  | 'funny'
  | 'adoption'
  | 'seasonal'
  | 'progress'
  | 'calm'
  | 'cuddling'
  | 'action'
  | 'hero'
  | 'greeting'
  | 'treat'
  | 'exploring'
  | 'day-in-life'
  | 'event'
  | 'success-story'
  | 'other';

export interface MediaDimensions {
  width: number;
  height: number;
}

export interface MediaMetadata {
  assetId: string | null;
  fileName: string | null;
  mimeType: string | null;
  originalUri: string | null;
  capturedAt: string | null;
  title: string;
  notes: string;
}

/** A durable, foster-owned item in the local media library. */
export interface MediaItem {
  id: string;
  fosterId: string;
  type: MediaType;
  /** App-local working copy. It may disappear when the app sandbox is reset. */
  localUri: string;
  thumbnailUri: string | null;
  /** Durable CDN copies used whenever local app storage is unavailable. */
  remoteUri?: string | null;
  remoteThumbnailUri?: string | null;
  /** Launch 1B server ownership IDs. URI-only records remain valid legacy media. */
  remoteMediaObjectId?: string | null;
  remoteThumbnailMediaObjectId?: string | null;
  metadata: MediaMetadata;
  tags: MediaCategoryTag[];
  favorite: boolean;
  source: MediaSource;
  dimensions: MediaDimensions | null;
  durationMs: number | null;
  sizeBytes: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type CoachMediaType = MediaType;

/** Completion is true when manually checked or when at least one media item is attached. */
export interface CoachGoalRecord {
  fosterId: string;
  mediaType: CoachMediaType;
  goalId: string;
  manuallyCompleted: boolean;
  mediaIds: string[];
  updatedAt: string;
}

export interface PlanDay {
  day: number;
  title: string;
  idea: string;
  format: string;
  status: 'todo' | 'done' | 'skipped';
}

/** The 15 content formats available from the Create tab. */
export type ContentType =
  | 'Social Media Post'
  | 'Facebook Post'
  | 'Instagram Caption'
  | 'Reel / TikTok Script'
  | 'Story Idea'
  | 'Adoption Bio'
  | 'Petfinder / Rescue Listing'
  | 'Local Community Post'
  | 'Adoption Event Post'
  | 'Please Share Post'
  | 'Progress Update'
  | 'Funny Post'
  | 'Heartwarming Post'
  | 'Urgent-but-Positive Post'
  | 'Pet Point-of-View Post';

export type ContentPlatform =
  | 'General'
  | 'Facebook'
  | 'Instagram'
  | 'Reel / TikTok'
  | 'Petfinder / Rescue'
  | 'Local Community';

export type ContentSourceType = 'photo' | 'video' | 'story' | 'idea';
export type ContentTone =
  | 'Warm'
  | 'Funny'
  | 'Heartwarming'
  | 'Playful'
  | 'Professional'
  | 'Hopeful'
  | 'Straightforward';
export type ContentLength = 'Short' | 'Medium' | 'Detailed';
export type ContentPostStatus = 'Draft' | 'Ready to Post' | 'Posted' | 'Archived';

/** A user-confirmed share to one destination. One content post can have many records. */
export interface PublicationRecord {
  id: string;
  contentPostId: string;
  petId: string;
  platform: import('./share-content').SharePlatform;
  postedAt: string;
  contentType: ContentType;
  mediaId: string | null;
  notes: string | null;
  createdAt: string;
}

/** A foster-specific activity shown in the Marketing Tracker. */
export interface MarketingActivity {
  id: string;
  petId: string;
  platform: string;
  contentType: string;
  summary: string;
  occurredAt: string;
  contentPostId: string | null;
  publicationRecordId: string | null;
  mediaId: string | null;
  source: 'publication' | 'manual';
  /** Outcomes are entered by the foster parent, never fetched from social platforms. */
  outcomes?: {
    inquiryReceived: boolean;
    applicationReceived: boolean;
    meetAndGreetInterest: boolean;
    notes: string;
  };
  createdAt: string;
}

export interface GeneratedContent {
  hook: string;
  caption: string;
  callToAction: string;
  onScreenText: string;
  keywords: string[];
  hashtags: string[];
  shortVersion: string;
  notes: string[];
  warnings: string[];
  generatedAt: string;
  /** Populated when the user asks for an idea instead of supplying media. */
  idea?: string;
  whatToCapture?: string;
  suggestedFormat?: string;
  whyThisHelps?: string;
  shotList?: string[];
  suggestedLength?: string;
  audioDirection?: string;
  stickerSuggestion?: string;
}

export type ContentCreationMode = 'ai' | 'manual';

export interface ContentPost {
  id: string;
  petId: string;
  contentType: ContentType;
  platform: ContentPlatform;
  hook: string;
  caption: string;
  callToAction: string;
  onScreenText: string;
  keywords: string[];
  hashtags: string[];
  shortVersion: string;
  notes: string[];
  warnings: string[];
  sourceType: ContentSourceType;
  /** Whether this draft was generated with writing help or kept as user-authored copy. */
  creationMode: ContentCreationMode;
  sourceDescription: string;
  /** First durable attachment, retained for legacy drafts and one-file share handoffs. */
  primaryMediaId?: string | null;
  /** Ordered durable attachments. Photo posts can include more than one image. */
  mediaIds?: string[];
  /** Legacy URI fallback used only while an older draft is migrated into the media library. */
  sourceUri: string | null;
  tone: ContentTone;
  length: ContentLength;
  status: ContentPostStatus;
  /** The active queue a record belonged to before it was archived. */
  archivedFromStatus?: Exclude<ContentPostStatus, 'Archived'>;
  createdAt: string;
  updatedAt: string;
  /** The current-information revision used to make this draft. */
  fosterInfoUpdatedAt?: string;
  /** Editor-only creation context needed to resume this draft accurately. */
  editorContext?: {
    specialRequest: string;
    urgencyReason: string;
    eventName: string;
    eventDate: string;
    eventTime: string;
    eventLocation: string;
    eventNotes: string;
  };
  planDay: number | null;
  versions: GeneratedContent[];
}

export type AdoptionBoostCategory =
  | 'add-profile-photo'
  | 'add-adoption-info'
  | 'update-personality'
  | 'create-adoption-bio'
  | 'refresh-adoption-bio'
  | 'hero-photo'
  | 'new-photo'
  | 'personality-photo'
  | 'short-video'
  | 'introduction-post'
  | 'funny-post'
  | 'progress-post'
  | 'ideal-home-post'
  | 'local-community-post'
  | 'please-share-post'
  | 'platform-variety'
  | 'prepare-content'
  | 'rest'
  | 'seven-day-boost';

export type AdoptionBoostPriority = 'critical' | 'high' | 'medium' | 'maintenance';

export type AdoptionBoostDestination =
  | 'profile-photo'
  | 'profile-personality'
  | 'profile-adoption'
  | 'adoption-bio'
  | 'photo-coach'
  | 'video-coach'
  | 'post-builder'
  | 'campaign'
  | 'none';

/** A persisted, foster-specific daily coaching recommendation. */
export interface AdoptionBoostRecommendation {
  id: string;
  petId: string;
  category: AdoptionBoostCategory;
  priority: AdoptionBoostPriority;
  title: string;
  explanation: string;
  suggestedAction: string;
  destination: AdoptionBoostDestination;
  destinationParams: Record<string, string>;
  sourceReason: string[];
  generatedAt: string;
  dateKey: string;
}

export type AdoptionBoostCampaignStatus = 'Active' | 'Completed' | 'Paused' | 'Cancelled';
export type AdoptionBoostTaskStatus = 'Todo' | 'Completed' | 'Skipped' | 'Replaced';

export interface AdoptionBoostCampaign {
  id: string;
  petId: string;
  startedAt: string;
  completedAt: string | null;
  status: AdoptionBoostCampaignStatus;
  currentDay: number;
  createdAt: string;
  updatedAt: string;
}

export type AdoptionBoostTaskType =
  | 'hero-photo'
  | 'personality-post'
  | 'short-video'
  | 'ideal-home-post'
  | 'progress-post'
  | 'local-community-post'
  | 'please-share-post';

export interface AdoptionBoostTask {
  id: string;
  campaignId: string;
  petId: string;
  day: number;
  taskType: AdoptionBoostTaskType;
  status: AdoptionBoostTaskStatus;
  completedAt: string | null;
  skippedAt: string | null;
  linkedContentPostId: string | null;
  createdAt: string;
  updatedAt: string;
}
