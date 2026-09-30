import * as Crypto from 'expo-crypto';
import { api } from './api/api';
import { calculateFosterDays } from './foster-duration';
import { latestProgressUpdate } from './foster-current-info';
import type {
  ContentLength,
  ContentPlatform,
  ContentSourceType,
  ContentTone,
  ContentType,
  Foster,
  GeneratedContent,
} from './types';

export type ContentTransformation =
  | 'another'
  | 'shorter'
  | 'longer'
  | 'funnier'
  | 'heartwarming'
  | 'professional'
  | 'playful';

export interface ContentGenerationRequest {
  foster: Foster;
  contentType: ContentType;
  platform: ContentPlatform;
  sourceType: ContentSourceType;
  sourceDescription: string;
  /** Public, app-owned photo URL used for optional visual grounding. */
  sourceMediaUrl?: string;
  tone: ContentTone;
  length: ContentLength;
  specialRequest?: string;
  event?: {
    name: string;
    date: string;
    time: string;
    location: string;
    notes: string;
  };
  urgencyReason?: string;
  existingContent?: GeneratedContent;
  transformation?: ContentTransformation;
}

interface BackendGenerationResponse {
  result: Omit<GeneratedContent, 'generatedAt'> & {
    idea: string | null;
    whatToCapture: string | null;
    suggestedFormat: string | null;
    whyThisHelps: string | null;
    suggestedLength: string | null;
    audioDirection: string | null;
    stickerSuggestion: string | null;
  };
  generatedAt: string;
  model: string;
}

function fosterFacts(foster: Foster) {
  const latestProgress = latestProgressUpdate(foster);
  return {
    id: foster.id,
    name: foster.name,
    species: foster.species,
    sex: foster.sex,
    age: foster.age,
    breed: foster.breed,
    weight: foster.weight,
    size: foster.size,
    fosterStartDate: foster.fosterStartDate,
    // Unknown duration stays unknown; stale legacy counters must not become a false zero in AI context.
    daysInFoster: calculateFosterDays(foster),
    personality: foster.personality,
    personalityNotes: foster.personalityNotes,
    goodWithDogs: foster.goodWithDogs,
    goodWithCats: foster.goodWithCats,
    goodWithChildren: foster.goodWithChildren,
    childrenNotes: foster.childrenNotes,
    houseTrained: foster.houseTrained,
    crateTrained: foster.crateTrained,
    energyLevel: foster.energyLevel,
    // Legacy progress text is historical once a newer timeline entry exists.
    special: { ...foster.special, progressMade: '' },
    currentStatus: foster.currentStatus?.trim() ?? '',
    latestProgress: latestProgress
      ? { summary: latestProgress.summary, occurredAt: latestProgress.occurredAt }
      : null,
    rescueName: foster.rescueName,
    city: foster.city,
    state: foster.state,
    adoptionUrl: foster.adoptionUrl,
    contactMethod: foster.contactMethod,
    adoptionFee: foster.adoptionFee,
    adoptionStatus: foster.adoptionStatus,
    considerations: foster.considerations,
  };
}

function backendRewrite(request: ContentGenerationRequest) {
  if (!request.transformation || !request.existingContent) return undefined;
  const typeByTransformation = {
    another: 'Try Another Version',
    shorter: 'Shorter',
    funnier: 'Funnier',
    heartwarming: 'More Heartwarming',
    longer: 'Custom',
    professional: 'Custom',
    playful: 'Custom',
  } as const;
  const customByTransformation = {
    longer: 'Make the draft more detailed while preserving every recorded fact.',
    professional: 'Make the draft more professional while preserving every recorded fact.',
    playful: 'Make the draft more playful while preserving every recorded fact.',
  } as const;
  const previous = request.existingContent;
  return {
    type: typeByTransformation[request.transformation],
    customInstruction:
      request.transformation in customByTransformation
        ? customByTransformation[
            request.transformation as keyof typeof customByTransformation
          ]
        : undefined,
    previousResult: {
      hook: previous.hook,
      caption: previous.caption,
      callToAction: previous.callToAction,
      onScreenText: previous.onScreenText,
      keywords: previous.keywords,
      hashtags: previous.hashtags,
      shortVersion: previous.shortVersion,
      notes: previous.notes,
      warnings: previous.warnings,
      idea: previous.idea ?? null,
      whatToCapture: previous.whatToCapture ?? null,
      suggestedFormat: previous.suggestedFormat ?? null,
      whyThisHelps: previous.whyThisHelps ?? null,
      shotList: previous.shotList ?? [],
      suggestedLength: previous.suggestedLength ?? null,
      audioDirection: previous.audioDirection ?? null,
      stickerSuggestion: previous.stickerSuggestion ?? null,
    },
  };
}

export function createContentGenerationActionKey(): string {
  return Crypto.randomUUID();
}

export const ContentGenerationService = {
  async generate(
    request: ContentGenerationRequest,
    signal?: AbortSignal,
    idempotencyKey = createContentGenerationActionKey()
  ): Promise<GeneratedContent> {
    // Source text belongs in source.description exactly once. Repeating it in context
    // makes both template and provider responses more likely to echo a foster parent's notes.
    const context = request.specialRequest
      ? `Additional writing direction: ${request.specialRequest}`
      : undefined;

    const response = await api.post<BackendGenerationResponse, unknown>(
      '/api/content/generate',
      {
        contentType: request.contentType,
        foster: fosterFacts(request.foster),
        tone: request.tone,
        length: request.length,
        source: {
          type: request.sourceType,
          description: request.sourceDescription,
          mediaUrl: request.sourceMediaUrl ?? null,
        },
        event: request.event
          ? {
              name: request.event.name,
              date: request.event.date,
              time: request.event.time,
              location: request.event.location,
              details: request.event.notes,
            }
          : undefined,
        urgency: request.urgencyReason
          ? { reason: request.urgencyReason, deadline: '' }
          : undefined,
        context,
        rewrite: backendRewrite(request),
      },
      signal,
      { 'Idempotency-Key': idempotencyKey }
    );

    return {
      ...response.result,
      idea: response.result.idea ?? undefined,
      whatToCapture: response.result.whatToCapture ?? undefined,
      suggestedFormat: response.result.suggestedFormat ?? undefined,
      whyThisHelps: response.result.whyThisHelps ?? undefined,
      suggestedLength: response.result.suggestedLength ?? undefined,
      audioDirection: response.result.audioDirection ?? undefined,
      stickerSuggestion: response.result.stickerSuggestion ?? undefined,
      generatedAt: response.generatedAt,
    };
  },
};
