import { beforeEach, describe, expect, mock, test } from 'bun:test';

const storage = new Map();

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

const { migratePersistedState, useAppStore } = await import('../src/lib/state/app-store');

function post(overrides = {}) {
  return {
    id: 'post-1',
    petId: 'valor',
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
    primaryMediaId: 'photo-1',
    sourceUri: 'file://photo-1.jpg',
    tone: 'Warm',
    length: 'Short',
    status: 'Draft',
    createdAt: '2026-09-23T12:00:00.000Z',
    updatedAt: '2026-09-23T12:00:00.000Z',
    planDay: null,
    versions: [],
    ...overrides,
  };
}

function media(id) {
  return {
    id,
    fosterId: 'valor',
    type: 'photo',
    localUri: `file://${id}.jpg`,
    remoteUri: null,
    thumbnailUri: null,
    remoteThumbnailUri: null,
    metadata: { originalUri: null },
    tags: [],
    deletedAt: null,
    updatedAt: '2026-09-23T12:00:00.000Z',
  };
}

beforeEach(() => {
  storage.clear();
  useAppStore.setState({ contentPosts: [], mediaItems: [] });
});

describe('content post media attachments', () => {
  test('migrates a legacy primary attachment into an ordered list', () => {
    const migrated = migratePersistedState({ contentPosts: [post()] });
    expect(migrated.contentPosts[0]).toMatchObject({
      primaryMediaId: 'photo-1',
      mediaIds: ['photo-1'],
    });
  });

  test('removes a URI-only attachment already owned by another foster', () => {
    const migrated = migratePersistedState({
      contentPosts: [post({ primaryMediaId: null, mediaIds: [], sourceUri: 'file://ralph-photo.jpg' })],
      mediaItems: [{ ...media('ralph-photo'), fosterId: 'ralph' }],
    });

    expect(migrated.contentPosts[0]).toMatchObject({
      petId: 'valor',
      primaryMediaId: null,
      mediaIds: [],
      sourceUri: null,
    });
  });

  test('does not import a known foreign URI during sharing reconciliation', async () => {
    useAppStore.setState({
      contentPosts: [post({ primaryMediaId: null, mediaIds: [], sourceUri: 'file://ralph-photo.jpg' })],
      mediaItems: [{ ...media('ralph-photo'), fosterId: 'ralph' }],
    });

    expect(await useAppStore.getState().ensureContentPostMedia('post-1')).toBe(false);
    expect(useAppStore.getState().contentPosts[0]).toMatchObject({
      primaryMediaId: null,
      mediaIds: [],
      sourceUri: null,
    });
  });

  test('deduplicates attachments and retains the saved cover first', () => {
    useAppStore.getState().saveContentPost(post({
      primaryMediaId: 'photo-2',
      mediaIds: ['photo-1', 'photo-2', 'photo-1'],
    }));

    expect(useAppStore.getState().contentPosts[0]).toMatchObject({
      primaryMediaId: 'photo-2',
      mediaIds: ['photo-2', 'photo-1'],
    });
  });

  test('promotes the next photo if the cover is deleted', async () => {
    useAppStore.setState({
      contentPosts: [post({ mediaIds: ['photo-1', 'photo-2'] })],
      mediaItems: [media('photo-1'), media('photo-2')],
    });

    expect(await useAppStore.getState().deleteMediaItem('photo-1')).toBe(true);
    expect(useAppStore.getState().contentPosts[0]).toMatchObject({
      primaryMediaId: 'photo-2',
      mediaIds: ['photo-2'],
      sourceUri: 'file://photo-2.jpg',
    });
  });

  test('removes only a deleted secondary photo', async () => {
    useAppStore.setState({
      contentPosts: [post({ mediaIds: ['photo-1', 'photo-2'] })],
      mediaItems: [media('photo-1'), media('photo-2')],
    });

    expect(await useAppStore.getState().deleteMediaItem('photo-2')).toBe(true);
    expect(useAppStore.getState().contentPosts[0]).toMatchObject({
      primaryMediaId: 'photo-1',
      mediaIds: ['photo-1'],
      sourceUri: 'file://photo-1.jpg',
    });
  });
});
