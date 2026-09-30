import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

let responder;
const credentialValues = new Map();
const calls = [];

mock.module('expo/fetch', () => ({
  fetch: (url, init) => responder(url, init),
}));

mock.module('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'when-unlocked-this-device-only',
  getItemAsync: async (key) => credentialValues.get(key) ?? null,
  setItemAsync: async (key, value) => {
    credentialValues.set(key, value);
  },
  deleteItemAsync: async (key) => {
    credentialValues.delete(key);
  },
}));
mock.module('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  makeDirectoryAsync: async () => undefined,
  copyAsync: async () => undefined,
  downloadAsync: async () => undefined,
  deleteAsync: async () => undefined,
  getInfoAsync: async () => ({ exists: true, size: 100 }),
}));
mock.module('expo-image-picker', () => ({}));
mock.module('expo-video-thumbnails', () => ({}));

const {
  configureAnonymousSessionForTesting,
  getAnonymousAccessToken,
} = await import('../src/lib/api/anonymous-session');
const { api } = await import('../src/lib/api/api');
const { getBackendUrl } = await import('../src/lib/api/backend-url');
const { createDurableMediaCopies } = await import('../src/lib/media-storage');
const originalPostForm = api.postForm;
const originalDelete = api.delete;

const refreshCredentialKey = 'foster-famous.installation-refresh.v1';
const mediaPostFormCalls = [];
const deletedMediaObjectIds = [];
let mediaPostFormResponder;

function session(accessToken, refreshCredential) {
  return {
    data: {
      accessToken,
      refreshCredential,
      accessExpiresAt: '2026-09-24T12:00:00.000Z',
      accessExpiresInSeconds: 900,
    },
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function installCredentialStore(options = {}) {
  configureAnonymousSessionForTesting({
    credentialStore: {
      getItemAsync: async (key) => {
        if (options.rejectRead) throw new Error('Keychain is locked');
        return credentialValues.get(key) ?? null;
      },
      setItemAsync: async (key, value) => {
        credentialValues.set(key, value);
      },
      deleteItemAsync: async (key) => {
        credentialValues.delete(key);
      },
    },
    fetch: (url, init) => responder(url, init),
  });
}

function durableMedia(overrides = {}) {
  return {
    id: 'media-retry-safe-1',
    type: 'photo',
    localUri: 'file:///documents/milo.jpg',
    thumbnailUri: null,
    remoteUri: null,
    remoteThumbnailUri: null,
    remoteMediaObjectId: null,
    remoteThumbnailMediaObjectId: null,
    metadata: { fileName: 'milo.jpg', mimeType: 'image/jpeg' },
    ...overrides,
  };
}

function uploadedMedia(mediaObjectId, url) {
  return {
    mediaObjectId,
    storageFileId: `storage-${mediaObjectId}`,
    url,
    filename: 'milo.jpg',
    mediaType: 'image',
    contentType: 'image/jpeg',
    sizeBytes: 100,
  };
}

beforeEach(() => {
  process.env.EXPO_PUBLIC_BACKEND_URL = 'https://media.foster-famous.test/api/';
  credentialValues.clear();
  calls.length = 0;
  mediaPostFormCalls.length = 0;
  deletedMediaObjectIds.length = 0;
  mediaPostFormResponder = async () => uploadedMedia('primary-object', 'https://cdn.example.test/milo.jpg');
  responder = async (url, init) => {
    calls.push({ url, init });
    throw new Error(`Unexpected request: ${url}`);
  };
  installCredentialStore();
});

afterEach(() => {
  api.postForm = originalPostForm;
  api.delete = originalDelete;
});

describe('anonymous installation upload session', () => {
  test('normalizes a legacy API suffix to one HTTPS origin', () => {
    expect(getBackendUrl()).toBe('https://media.foster-famous.test');
  });

  test('creates the first session before an authenticated multipart upload', async () => {
    responder = async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith('/api/installations/register')) return json(session('access-one', 'refresh-one'));
      if (url.endsWith('/api/media/upload')) return json({ data: { uploaded: true } });
      throw new Error(`Unexpected request: ${url}`);
    };

    const form = new FormData();
    form.append('file', new Blob(['photo']), 'photo.jpg');
    await expect(api.postForm('/api/media/upload', form, { 'Idempotency-Key': 'media-upload-test-primary' }))
      .resolves.toEqual({ uploaded: true });

    expect(calls.map((call) => call.url)).toEqual([
      'https://media.foster-famous.test/api/installations/register',
      'https://media.foster-famous.test/api/media/upload',
    ]);
    expect(calls[1]?.init?.headers).toMatchObject({
      Authorization: 'Bearer access-one',
      'Idempotency-Key': 'media-upload-test-primary',
    });
    expect(calls[1]?.init?.headers).not.toHaveProperty('Content-Type');
    expect(credentialValues.get(refreshCredentialKey)).toBe('refresh-one');
  });

  test('rehydrates a SecureStore credential after a process restart', async () => {
    credentialValues.set(refreshCredentialKey, 'refresh-one');
    responder = async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith('/api/installations/refresh')) return json(session('access-two', 'refresh-two'));
      throw new Error(`Unexpected request: ${url}`);
    };

    await expect(getAnonymousAccessToken()).resolves.toBe('access-two');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://media.foster-famous.test/api/installations/refresh');
    expect(credentialValues.get(refreshCredentialKey)).toBe('refresh-two');
  });

  test('uses exactly one refresh and preserves the idempotency key after a 401', async () => {
    responder = async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith('/api/installations/register')) return json(session('access-one', 'refresh-one'));
      if (url.endsWith('/api/installations/refresh')) return json(session('access-two', 'refresh-two'));
      if (url.endsWith('/api/media/upload') && calls.filter((call) => call.url.endsWith('/api/media/upload')).length === 1) {
        return json({ error: { message: 'Expired access token', code: 'AUTHENTICATION_REQUIRED' } }, 401);
      }
      if (url.endsWith('/api/media/upload')) return json({ data: { uploaded: true } });
      throw new Error(`Unexpected request: ${url}`);
    };

    const form = new FormData();
    form.append('file', new Blob(['video']), 'video.mp4');
    await expect(api.postForm('/api/media/upload', form, { 'Idempotency-Key': 'media-upload-retry-primary' }))
      .resolves.toEqual({ uploaded: true });

    const uploadCalls = calls.filter((call) => call.url.endsWith('/api/media/upload'));
    expect(calls.map((call) => call.url)).toEqual([
      'https://media.foster-famous.test/api/installations/register',
      'https://media.foster-famous.test/api/media/upload',
      'https://media.foster-famous.test/api/installations/refresh',
      'https://media.foster-famous.test/api/media/upload',
    ]);
    expect(uploadCalls).toHaveLength(2);
    expect(uploadCalls.map((call) => call.init.headers['Idempotency-Key']))
      .toEqual(['media-upload-retry-primary', 'media-upload-retry-primary']);
    expect(uploadCalls.map((call) => call.init.headers.Authorization))
      .toEqual(['Bearer access-one', 'Bearer access-two']);
  });

  test('does not enroll a replacement installation if SecureStore is unavailable', async () => {
    installCredentialStore({ rejectRead: true });

    await expect(getAnonymousAccessToken()).rejects.toMatchObject({
      code: 'SECURE_STORE_READ_FAILED',
      status: 0,
    });
    expect(calls).toHaveLength(0);
  });
});

describe('durable media upload lifecycle', () => {
  function interceptMediaApi() {
    api.postForm = async (url, body, headers) => {
      mediaPostFormCalls.push({ url, body, headers });
      return mediaPostFormResponder(url, body, headers);
    };
    api.delete = async (url) => {
      deletedMediaObjectIds.push(url);
      return { deleted: true };
    };
  }

  test('uses the same photo idempotency key when a durable-copy retry repeats', async () => {
    interceptMediaApi();
    const selectedMedia = durableMedia();
    mediaPostFormResponder = async () => {
      if (mediaPostFormCalls.length === 1) throw new Error('transport lost');
      return uploadedMedia('primary-object', 'https://cdn.example.test/milo.jpg');
    };

    await expect(createDurableMediaCopies(selectedMedia)).rejects.toMatchObject({
      code: 'MEDIA_UPLOAD_NETWORK_ERROR',
    });
    await expect(createDurableMediaCopies(selectedMedia)).resolves.toMatchObject({
      remoteMediaObjectId: 'primary-object',
      remoteThumbnailMediaObjectId: 'primary-object',
    });

    expect(mediaPostFormCalls.map((call) => call.headers['Idempotency-Key']))
      .toEqual(['media-upload-media-retry-safe-1-primary', 'media-upload-media-retry-safe-1-primary']);
  });

  test('uploads video and thumbnail independently and cleans up a newly uploaded video if its thumbnail fails', async () => {
    interceptMediaApi();
    const selectedMedia = durableMedia({
      id: 'media-video-1',
      type: 'video',
      localUri: 'file:///documents/milo.mp4',
      thumbnailUri: 'file:///documents/milo-thumbnail.jpg',
      metadata: { fileName: 'milo.mp4', mimeType: 'video/mp4' },
    });
    mediaPostFormResponder = async (_url, _body, headers) => {
      if (headers['Idempotency-Key'].endsWith('-primary')) {
        return uploadedMedia('video-object', 'https://cdn.example.test/milo.mp4');
      }
      throw new Error('thumbnail upload unavailable');
    };

    await expect(createDurableMediaCopies(selectedMedia)).rejects.toMatchObject({
      code: 'MEDIA_UPLOAD_NETWORK_ERROR',
    });

    expect(mediaPostFormCalls.map((call) => call.headers['Idempotency-Key'])).toEqual([
      'media-upload-media-video-1-primary',
      'media-upload-media-video-1-thumbnail',
    ]);
    expect(deletedMediaObjectIds).toEqual(['/api/media/video-object']);
  });
});
