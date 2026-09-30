import type { ContentCreationMode, ContentSourceType, GeneratedContent, MediaItem } from './types';

export interface CreateWorkspaceReset {
  creationMode: ContentCreationMode;
  source: ContentSourceType;
  sourceDescription: string;
  mediaIds: string[];
  sourceUri: string | null;
  generated: GeneratedContent | null;
  previousVersion: GeneratedContent | null;
  generatedAgainstCurrentInfoAt: string | undefined;
}

export interface GenerationScope {
  fosterId: string;
  requestId: string;
  idempotencyKey: string;
}

export function freshCreateWorkspace(): CreateWorkspaceReset {
  return {
    creationMode: 'ai',
    source: 'idea',
    sourceDescription: '',
    mediaIds: [],
    sourceUri: null,
    generated: null,
    previousVersion: null,
    generatedAgainstCurrentInfoAt: undefined,
  };
}

/** A generation result may only update the foster and action that started it. */
export function isCurrentGenerationScope(
  activeScope: GenerationScope | null,
  selectedFosterId: string,
  resultScope: GenerationScope
): boolean {
  return Boolean(
    activeScope &&
      activeScope.requestId === resultScope.requestId &&
      activeScope.fosterId === resultScope.fosterId &&
      selectedFosterId === resultScope.fosterId
  );
}

/** Reject media that belongs to another foster before it can enter a draft. */
export function ownedMediaIds(
  mediaIds: readonly string[],
  fosterId: string,
  mediaItems: readonly MediaItem[]
): string[] {
  return mediaIds.filter((id) => mediaItems.some((media) => media.id === id && media.fosterId === fosterId));
}
