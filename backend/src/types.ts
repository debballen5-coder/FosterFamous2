import { z } from "zod";

export const CONTENT_TYPES = [
  "Social Media Post",
  "Facebook Post",
  "Instagram Caption",
  "Reel / TikTok Script",
  "Story Idea",
  "Adoption Bio",
  "Petfinder / Rescue Listing",
  "Local Community Post",
  "Adoption Event Post",
  "Please Share Post",
  "Progress Update",
  "Funny Post",
  "Heartwarming Post",
  "Urgent-but-Positive Post",
  "Pet Point-of-View Post",
] as const;

export const ContentTypeSchema = z.enum(CONTENT_TYPES);
export const ToneSchema = z.enum([
  "Warm",
  "Funny",
  "Heartwarming",
  "Playful",
  "Professional",
  "Hopeful",
  "Straightforward",
]);
export const LengthSchema = z.enum(["Short", "Medium", "Detailed"]);
export const SourceTypeSchema = z.enum(["photo", "video", "story", "idea"]);
export const CompatibilitySchema = z.enum(["Yes", "No", "Unknown", "Still evaluating"]);
export const AdoptionStatusSchema = z.enum([
  "Not Yet Available",
  "Available",
  "Application Pending",
  "Meet-and-Greet Scheduled",
  "Adoption Pending",
  "Medical Hold",
  "Foster Hold",
  "Returned to Rescue/Shelter",
  "Adopted",
]);

const optionalText = (max: number) => z.string().trim().max(max).optional().default("");

export const FosterFactsSchema = z
  .object({
    id: z.string().trim().min(1).max(100),
    name: z.string().trim().min(1).max(100),
    species: z.enum(["dog", "cat"]),
    sex: z.enum(["Male", "Female", "Unknown"]),
    age: optionalText(100),
    breed: optionalText(150),
    weight: optionalText(100),
    size: z.enum(["Small", "Medium", "Large", "Extra Large"]).nullable().optional().default(null),
    fosterStartDate: z.string().trim().max(50).nullable().optional().default(null),
    // Null means the stored foster start or adoption date needs correction; it is never a fake zero.
    daysInFoster: z.number().int().min(0).max(20_000).nullable().optional().default(null),
    personality: z.array(z.string().trim().min(1).max(80)).max(30).optional().default([]),
    personalityNotes: optionalText(2_000),
    goodWithDogs: CompatibilitySchema,
    goodWithCats: CompatibilitySchema,
    goodWithChildren: CompatibilitySchema,
    childrenNotes: optionalText(1_000),
    houseTrained: CompatibilitySchema,
    crateTrained: CompatibilitySchema,
    energyLevel: z.enum(["Low", "Moderate", "High", "Very High"]).nullable().optional().default(null),
    special: z
      .object({
        favoriteActivity: optionalText(500),
        favoriteToy: optionalText(500),
        favoriteTreat: optionalText(500),
        funniestHabit: optionalText(1_000),
        bestSkill: optionalText(500),
        mostLovableQuality: optionalText(1_000),
        makesYouLaugh: optionalText(1_000),
        progressMade: optionalText(1_500),
        idealHome: optionalText(1_500),
      })
      .optional()
      .default({
        favoriteActivity: "",
        favoriteToy: "",
        favoriteTreat: "",
        funniestHabit: "",
        bestSkill: "",
        mostLovableQuality: "",
        makesYouLaugh: "",
        progressMade: "",
        idealHome: "",
      }),
    /** The foster parent's present, verified status. */
    currentStatus: optionalText(1_500),
    /** Only the newest verified milestone is generation context; older timeline entries stay historical. */
    latestProgress: z
      .object({
        summary: z.string().trim().min(1).max(1_500),
        occurredAt: optionalText(100),
      })
      .nullable()
      .optional()
      .default(null),
    rescueName: optionalText(200),
    city: optionalText(150),
    state: optionalText(100),
    adoptionUrl: optionalText(1_000),
    contactMethod: optionalText(500),
    adoptionFee: optionalText(100),
    adoptionStatus: AdoptionStatusSchema,
    considerations: z.array(z.string().trim().min(1).max(150)).max(30).optional().default([]),
  })
  .strict();

export const ContentSourceSchema = z
  .object({
    type: SourceTypeSchema,
    description: optionalText(4_000),
    mediaUrl: z.string().trim().max(2_000).nullable().optional().default(null),
  })
  .strict();

export const EventDetailsSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    date: optionalText(100),
    time: optionalText(100),
    location: optionalText(300),
    details: optionalText(1_500),
  })
  .strict();

export const UrgencySchema = z
  .object({
    reason: z.string().trim().min(1).max(1_000),
    deadline: optionalText(100),
  })
  .strict();

export const RewriteInstructionSchema = z
  .object({
    type: z.enum(["Try Another Version", "Shorter", "Funnier", "More Heartwarming", "Custom"]),
    customInstruction: z.string().trim().min(1).max(1_000).optional(),
    previousResult: z
      .object({
        hook: z.string(),
        caption: z.string(),
        callToAction: z.string(),
        onScreenText: z.string(),
        keywords: z.array(z.string()),
        hashtags: z.array(z.string()),
        shortVersion: z.string(),
        notes: z.array(z.string()),
        warnings: z.array(z.string()),
        idea: z.string().nullable(),
        whatToCapture: z.string().nullable(),
        suggestedFormat: z.string().nullable(),
        whyThisHelps: z.string().nullable(),
        shotList: z.array(z.string()),
        suggestedLength: z.string().nullable(),
        audioDirection: z.string().nullable(),
        stickerSuggestion: z.string().nullable(),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.type === "Custom" && !value.customInstruction) {
      ctx.addIssue({ code: "custom", path: ["customInstruction"], message: "Required for a custom rewrite" });
    }
  });

export const GeneratedContentSchema = z
  .object({
    hook: z.string().trim().max(500),
    caption: z.string().trim().min(1).max(8_000),
    callToAction: z.string().trim().min(1).max(1_000),
    onScreenText: z.string().trim().max(500),
    keywords: z.array(z.string().trim().min(1).max(100)).max(30),
    hashtags: z.array(z.string().trim().min(1).max(100)).max(30),
    shortVersion: z.string().trim().max(2_000),
    notes: z.array(z.string().trim().min(1).max(500)).max(20),
    warnings: z.array(z.string().trim().min(1).max(500)).max(20),
    idea: z.string().trim().max(2_000).nullable(),
    whatToCapture: z.string().trim().max(2_000).nullable(),
    suggestedFormat: z.string().trim().max(500).nullable(),
    whyThisHelps: z.string().trim().max(2_000).nullable(),
    shotList: z.array(z.string().trim().min(1).max(500)).max(20),
    suggestedLength: z.string().trim().max(200).nullable(),
    audioDirection: z.string().trim().max(500).nullable(),
    stickerSuggestion: z.string().trim().max(500).nullable(),
  })
  .strict();

export const ContentGenerationRequestSchema = z
  .object({
    contentType: ContentTypeSchema,
    foster: FosterFactsSchema,
    tone: ToneSchema,
    length: LengthSchema,
    source: ContentSourceSchema,
    event: EventDetailsSchema.optional(),
    urgency: UrgencySchema.optional(),
    context: z.string().trim().max(4_000).optional(),
    rewrite: RewriteInstructionSchema.optional(),
  })
  .strict();

export const ContentGenerationResponseSchema = z
  .object({
    result: GeneratedContentSchema,
    generatedAt: z.string().datetime(),
    model: z.enum(["gpt-5.6", "foster-famous-template-v1"]),
  })
  .strict();

export type ContentGenerationRequest = z.infer<typeof ContentGenerationRequestSchema>;
export type GeneratedContent = z.infer<typeof GeneratedContentSchema>;
export type ContentGenerationResponse = z.infer<typeof ContentGenerationResponseSchema>;
export type FosterFacts = z.infer<typeof FosterFactsSchema>;

/** The app-owned, durable CDN copy returned after a media file is uploaded. */
export const UploadedMediaFileSchema = z
  .object({
    // App-owned ID. Storage provider IDs never authorize client operations.
    mediaObjectId: z.string().trim().min(1),
    storageFileId: z.string().trim().min(1),
    url: z.string().url(),
    filename: z.string().trim().min(1).max(500),
    mediaType: z.enum(["image", "video"]),
    contentType: z.string().trim().min(1).max(200),
    sizeBytes: z.number().int().nonnegative(),
  })
  .strict();

export type UploadedMediaFile = z.infer<typeof UploadedMediaFileSchema>;
