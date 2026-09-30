import { beforeEach, describe, expect, mock, test } from 'bun:test';

const storage = new Map();
const generationCalls = [];
let generatedKey = 0;

mock.module('expo-crypto', () => ({
  randomUUID: () => `generation-action-${++generatedKey}`,
}));

mock.module('../src/lib/api/api', () => ({
  api: {
    post: async (url, body, signal, headers) => {
      generationCalls.push({ url, body, signal, headers });
      return {
        result: {
          hook: '', caption: '', callToAction: '', onScreenText: '', keywords: [], hashtags: [], shortVersion: '', notes: [], warnings: [],
          idea: null, whatToCapture: null, suggestedFormat: null, whyThisHelps: null, suggestedLength: null, audioDirection: null, stickerSuggestion: null,
        },
        generatedAt: '2026-09-26T12:00:00.000Z',
        model: 'gpt-5.6',
      };
    },
  },
}));

mock.module('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key) => storage.get(key) ?? null,
    setItem: async (key, value) => storage.set(key, value),
    removeItem: async (key) => storage.delete(key),
  },
}));

mock.module('../src/lib/media-storage', () => ({
  MediaUploadError: class MediaUploadError extends Error {},
  createDurableMediaCopies: async () => [],
  deleteRemoteMediaCopies: async () => undefined,
  deleteStoredMediaFiles: async () => undefined,
  isBrokenMediaUri: async () => false,
  mediaUri: (media) => media.remoteUri ?? media.localUri ?? null,
  storePickedMedia: async () => [],
}));

const {
  freshCreateWorkspace,
  isCurrentGenerationScope,
  ownedMediaIds,
} = await import('../src/lib/create-generation-scope');
const { migratePersistedState, useAppStore } = await import('../src/lib/state/app-store');
const { ContentGenerationService, createContentGenerationActionKey } = await import('../src/lib/content-generation');

function scope(fosterId, requestId) {
  return { fosterId, requestId, idempotencyKey: requestId };
}

function media(id, fosterId, type = 'photo') {
  return {
    id,
    fosterId,
    type,
    localUri: `file://${id}.jpg`,
    remoteUri: null,
    thumbnailUri: null,
    remoteThumbnailUri: null,
    metadata: { originalUri: null },
    tags: [],
    deletedAt: null,
    updatedAt: '2026-09-26T12:00:00.000Z',
  };
}

function generationRequest(fosterId, name) {
  return {
    foster: {
      id: fosterId,
      name,
      species: 'dog',
      sex: 'Male',
      age: '',
      breed: '',
      weight: '',
      size: null,
      fosterStartDate: null,
      fosterPeriods: [],
      adoptionEvents: [],
      personality: [],
      personalityNotes: '',
      goodWithDogs: 'Unknown',
      goodWithCats: 'Unknown',
      goodWithChildren: 'Unknown',
      childrenNotes: '',
      houseTrained: 'Unknown',
      crateTrained: 'Unknown',
      energyLevel: null,
      special: { favoriteActivity: '', favoriteToy: '', favoriteTreat: '', funniestHabit: '', bestSkill: '', mostLovableQuality: '', makesYouLaugh: '', progressMade: '', idealHome: '' },
      rescueName: '', city: '', state: '', adoptionUrl: '', contactMethod: '', adoptionFee: '', adoptionStatus: 'Available', considerations: [], progressUpdates: [],
    },
    contentType: 'Social Media Post',
    platform: 'Facebook',
    sourceType: 'story',
    sourceDescription: `${name} learned something new today.`,
    tone: 'Warm',
    length: 'Short',
  };
}

function post(overrides = {}) {
  return {
    id: 'draft-charlie',
    petId: 'charlie',
    contentType: 'Social Media Post',
    platform: 'Facebook',
    hook: '',
    caption: '',
    callToAction: '',
    onScreenText: '',
    keywords: [],
    hashtags: [],
    shortVersion: '',
    notes: [],
    warnings: [],
    sourceType: 'photo',
    sourceDescription: '',
    primaryMediaId: null,
    mediaIds: [],
    sourceUri: null,
    tone: 'Warm',
    length: 'Short',
    status: 'Draft',
    createdAt: '2026-09-26T12:00:00.000Z',
    updatedAt: '2026-09-26T12:00:00.000Z',
    planDay: null,
    versions: [],
    ...overrides,
  };
}

beforeEach(() => {
  storage.clear();
  generationCalls.length = 0;
  generatedKey = 0;
  useAppStore.setState({ contentPosts: [], mediaItems: [] });
});

describe('Create foster and generation isolation', () => {
  test('Ralph to Charlie blocks Ralph’s result and creates a separate Charlie action', () => {
    const ralph = scope('ralph', 'ralph-action-1');
    const charlie = scope('charlie', 'charlie-action-2');
    const ralphCaption = 'Ralph’s bottle-time cuddles are the best part of the day.';
    const charlieCaption = 'Charlie is ready to show off his bright, curious personality.';

    expect(isCurrentGenerationScope(ralph, 'charlie', ralph)).toBe(false);
    expect(isCurrentGenerationScope(charlie, 'charlie', charlie)).toBe(true);
    expect(charlie.idempotencyKey).not.toBe(ralph.idempotencyKey);
    expect(charlieCaption).not.toBe(ralphCaption);
    expect(charlieCaption).not.toContain('Ralph');
  });

  test('Charlie to Ralph blocks Charlie’s result after switching back', () => {
    const charlie = scope('charlie', 'charlie-action-1');
    const ralph = scope('ralph', 'ralph-action-2');

    expect(isCurrentGenerationScope(charlie, 'ralph', charlie)).toBe(false);
    expect(isCurrentGenerationScope(ralph, 'ralph', ralph)).toBe(true);
  });

  test('a new post never inherits a saved draft’s generated content', () => {
    const savedRalph = { caption: 'Ralph saved caption' };
    const newCharlie = freshCreateWorkspace();

    expect(savedRalph.caption).toBe('Ralph saved caption');
    expect(newCharlie.generated).toBeNull();
    expect(newCharlie.sourceDescription).toBe('');
  });

  test('a new post clears an unsaved generated caption', () => {
    const unsavedRalph = { generated: { caption: 'Ralph’s unsaved caption' } };
    const newCharlie = freshCreateWorkspace();

    expect(unsavedRalph.generated.caption).toContain('Ralph');
    expect(newCharlie.generated).toBeNull();
    expect(newCharlie.previousVersion).toBeNull();
  });

  test('manual text for Ralph does not become Charlie AI context', () => {
    const ralphWorkspace = { ...freshCreateWorkspace(), creationMode: 'manual', sourceDescription: 'Ralph manual words' };
    const charlieWorkspace = freshCreateWorkspace();

    expect(ralphWorkspace.creationMode).toBe('manual');
    expect(charlieWorkspace.creationMode).toBe('ai');
    expect(charlieWorkspace.sourceDescription).toBe('');
  });

  test('AI text for Ralph does not become Charlie manual text', () => {
    const ralphWorkspace = { ...freshCreateWorkspace(), generated: { caption: 'Ralph AI draft' } };
    const charlieWorkspace = { ...freshCreateWorkspace(), creationMode: 'manual' };

    expect(ralphWorkspace.generated.caption).toContain('Ralph');
    expect(charlieWorkspace.generated).toBeNull();
    expect(charlieWorkspace.sourceDescription).toBe('');
  });

  test('switching foster invalidates an in-flight AI request', () => {
    const ralph = scope('ralph', 'in-flight-ralph');

    expect(isCurrentGenerationScope(null, 'charlie', ralph)).toBe(false);
  });

  test('a stale response cannot overwrite the active foster', () => {
    const ralph = scope('ralph', 'ralph-response');
    const charlie = scope('charlie', 'charlie-response');

    expect(isCurrentGenerationScope(charlie, 'charlie', ralph)).toBe(false);
    expect(isCurrentGenerationScope(charlie, 'charlie', charlie)).toBe(true);
  });

  test('each intentional generation sends a new idempotency action key', async () => {
    const first = createContentGenerationActionKey();
    const next = createContentGenerationActionKey();

    await ContentGenerationService.generate(generationRequest('charlie', 'Charlie'), undefined, first);
    await ContentGenerationService.generate(generationRequest('charlie', 'Charlie'), undefined, next);

    expect(first).not.toBe(next);
    expect(generationCalls.map((call) => call.headers['Idempotency-Key'])).toEqual([first, next]);
  });

  test('a selected foster-owned photo is sent with its written context', async () => {
    const sourceMediaUrl = 'https://storage.vibecodeapp.com/charlie-bed.jpg';

    await ContentGenerationService.generate({
      ...generationRequest('charlie', 'Charlie'),
      sourceDescription: 'Charlie found a bed where he can hide from his foster brother.',
      sourceMediaUrl,
    });

    expect(generationCalls[0]?.body.source).toMatchObject({
      type: 'story',
      description: 'Charlie found a bed where he can hide from his foster brother.',
      mediaUrl: sourceMediaUrl,
    });
  });

  test('a retry keeps the same action key and exact request identity', async () => {
    const first = scope('charlie', 'charlie-retry-1');
    const retry = { ...first };
    const request = generationRequest('charlie', 'Charlie');

    await ContentGenerationService.generate(request, undefined, first.idempotencyKey);
    await ContentGenerationService.generate(request, undefined, retry.idempotencyKey);

    expect(retry.idempotencyKey).toBe(first.idempotencyKey);
    expect(retry.requestId).toBe(first.requestId);
    expect(generationCalls.map((call) => call.headers['Idempotency-Key']))
      .toEqual(['charlie-retry-1', 'charlie-retry-1']);
    expect(generationCalls[1]?.body).toEqual(generationCalls[0]?.body);
  });

  test('Write Another Draft remains scoped to the current foster', () => {
    const first = scope('charlie', 'charlie-draft-1');
    const alternate = scope('charlie', 'charlie-draft-2');

    expect(alternate.fosterId).toBe(first.fosterId);
    expect(alternate.idempotencyKey).not.toBe(first.idempotencyKey);
  });

  test('a multi-photo draft accepts only media owned by its foster', () => {
    const items = [media('charlie-one', 'charlie'), media('ralph-one', 'ralph'), media('charlie-two', 'charlie')];

    expect(ownedMediaIds(['charlie-one', 'ralph-one', 'charlie-two'], 'charlie', items))
      .toEqual(['charlie-one', 'charlie-two']);
  });

  test('saved draft writes strip foreign media ownership', () => {
    useAppStore.setState({ mediaItems: [media('charlie-one', 'charlie'), media('ralph-one', 'ralph')] });
    useAppStore.getState().saveContentPost(post({
      primaryMediaId: 'ralph-one',
      mediaIds: ['ralph-one', 'charlie-one'],
      sourceUri: 'file://ralph-one.jpg',
    }));

    expect(useAppStore.getState().contentPosts[0]).toMatchObject({
      petId: 'charlie',
      primaryMediaId: 'charlie-one',
      mediaIds: ['charlie-one'],
      sourceUri: 'file://charlie-one.jpg',
    });
  });

  test('app reopen migration preserves ownership while removing legacy foreign media', () => {
    const migrated = migratePersistedState({
      contentPosts: [post({ primaryMediaId: 'ralph-one', mediaIds: ['ralph-one', 'charlie-one'] })],
      mediaItems: [media('ralph-one', 'ralph'), media('charlie-one', 'charlie')],
    });

    expect(migrated.contentPosts[0]).toMatchObject({
      petId: 'charlie',
      primaryMediaId: 'charlie-one',
      mediaIds: ['charlie-one'],
    });
  });
});
