import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';

import { ApiError, api } from './api/api';
import type { MediaCategoryTag, MediaItem, MediaSource, MediaType } from './types';

const MEDIA_DIRECTORY_NAME = 'foster-famous-media';
// The backend admits up to 10 uploads per device in a 10-minute window.
// Keep one picker batch within that capacity so every selected photo can finish.
const DEFAULT_PHOTO_LIMIT = 10;

type UploadedMediaFile = {
  mediaObjectId: string;
  storageFileId: string;
  url: string;
  filename: string;
  mediaType: 'image' | 'video';
  contentType: string;
  sizeBytes: number;
};

export class MediaUploadError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'MediaUploadError';
  }
}

function uploadIdFor(mediaId: string, part: 'primary' | 'thumbnail'): string {
  const safeMediaId = mediaId.replace(/[^A-Za-z0-9._~-]/g, '-').slice(0, 160) || 'media';
  return `media-upload-${safeMediaId}-${part}`;
}

async function uploadDurableMedia(
  uri: string,
  filename: string,
  mimeType: string,
  uploadId: string
): Promise<UploadedMediaFile> {
  const formData = new FormData();
  formData.append('file', { uri, name: filename, type: mimeType } as never);

  try {
    // postForm uses the existing anonymous session: access token in memory,
    // SecureStore refresh credential on restart, and exactly one 401 retry.
    // Do not set Content-Type: React Native adds the multipart boundary.
    return await api.postForm<UploadedMediaFile>('/api/media/upload', formData, {
      'Idempotency-Key': uploadId,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      const message = error.code === 'MISSING_BACKEND_URL' || error.code === 'INVALID_BACKEND_URL'
        ? 'Media storage is not configured.'
        : error.message;
      throw new MediaUploadError(message, error.code, error.status);
    }
    throw new MediaUploadError('The media file could not be uploaded. Please try again.', 'MEDIA_UPLOAD_NETWORK_ERROR', 0);
  }
}

async function removeUploadedMediaOnFailure(mediaObjectId: string): Promise<void> {
  await api.delete<{ deleted: boolean }>(`/api/media/${encodeURIComponent(mediaObjectId)}`).catch(() => undefined);
}

/** Deletes only server-owned Launch 1B cloud objects. URL-only legacy media is untouched. */
export async function deleteRemoteMediaCopies(
  media: Pick<MediaItem, 'remoteMediaObjectId' | 'remoteThumbnailMediaObjectId'>
): Promise<void> {
  const objectIds = [...new Set([
    media.remoteMediaObjectId,
    media.remoteThumbnailMediaObjectId,
  ].filter((id): id is string => Boolean(id)))];

  for (const mediaObjectId of objectIds) {
    await api.delete<{ deleted: boolean }>(`/api/media/${encodeURIComponent(mediaObjectId)}`);
  }
}

export function mediaUri(media: Pick<MediaItem, 'localUri' | 'thumbnailUri' | 'remoteUri' | 'remoteThumbnailUri'>, thumbnail = false): string {
  if (thumbnail) return media.remoteThumbnailUri ?? media.remoteUri ?? media.thumbnailUri ?? media.localUri;
  return media.remoteUri ?? media.localUri;
}

export interface PickMediaResult {
  canceled: boolean;
  permissionDenied: boolean;
  assets: ImagePicker.ImagePickerAsset[];
}

export interface StorePickedMediaOptions {
  fosterId: string;
  type: MediaType;
  assets: readonly ImagePicker.ImagePickerAsset[];
  source?: MediaSource;
  tags?: readonly MediaCategoryTag[];
}

function createMediaId(): string {
  return `media-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizePathSegment(value: string): string {
  const sanitized = value.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-');
  return sanitized || 'unknown';
}

function extensionForAsset(asset: ImagePicker.ImagePickerAsset, type: MediaType): string {
  const namedExtension = asset.fileName?.match(/\.([a-zA-Z0-9]{1,8})$/)?.[1];
  if (namedExtension) return namedExtension.toLowerCase();

  const uriWithoutQuery = asset.uri.split('?')[0];
  const uriExtension = uriWithoutQuery.match(/\.([a-zA-Z0-9]{1,8})$/)?.[1];
  if (uriExtension) return uriExtension.toLowerCase();

  const mimeExtension = asset.mimeType?.split('/')[1]?.split('+')[0];
  if (mimeExtension) return mimeExtension === 'quicktime' ? 'mov' : mimeExtension;

  return type === 'photo' ? 'jpg' : 'mp4';
}

function requireDocumentDirectory(): string {
  if (!FileSystem.documentDirectory) {
    throw new Error('Durable media storage is unavailable on this device.');
  }
  return `${FileSystem.documentDirectory}${MEDIA_DIRECTORY_NAME}/`;
}

async function ensureFosterDirectory(fosterId: string): Promise<string> {
  const directory = `${requireDocumentDirectory()}${sanitizePathSegment(fosterId)}/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  return directory;
}

async function copyToDurableUri(sourceUri: string, destinationUri: string): Promise<void> {
  if (/^https?:\/\//i.test(sourceUri)) {
    await FileSystem.downloadAsync(sourceUri, destinationUri);
    return;
  }
  await FileSystem.copyAsync({ from: sourceUri, to: destinationUri });
}

export async function pickMediaFromLibrary(
  type: MediaType,
  photoSelectionLimit = DEFAULT_PHOTO_LIMIT
): Promise<PickMediaResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return { canceled: false, permissionDenied: true, assets: [] };
  }

  const isPhoto = type === 'photo';
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: isPhoto ? ['images'] : ['videos'],
    allowsMultipleSelection: isPhoto,
    selectionLimit: isPhoto ? Math.max(1, photoSelectionLimit) : 1,
    allowsEditing: false,
    quality: 0.9,
    videoQuality: ImagePicker.UIImagePickerControllerQualityType.High,
  });

  return {
    canceled: result.canceled,
    permissionDenied: false,
    assets: result.canceled ? [] : result.assets.slice(0, isPhoto ? photoSelectionLimit : 1),
  };
}

export async function storePickedMedia({
  fosterId,
  type,
  assets,
  source = 'library',
  tags = [],
}: StorePickedMediaOptions): Promise<MediaItem[]> {
  const selectedAssets = type === 'video' ? assets.slice(0, 1) : assets;
  const directory = await ensureFosterDirectory(fosterId);

  return Promise.all(
    selectedAssets.map(async (asset): Promise<MediaItem> => {
      const id = createMediaId();
      const extension = extensionForAsset(asset, type);
      const localUri = `${directory}${id}.${extension}`;
      await copyToDurableUri(asset.uri, localUri);

      let thumbnailUri: string | null = type === 'photo' ? localUri : null;
      if (type === 'video') {
        const thumbnail = await VideoThumbnails.getThumbnailAsync(localUri, { time: 0, quality: 0.8 });
        thumbnailUri = `${directory}${id}-thumbnail.jpg`;
        await copyToDurableUri(thumbnail.uri, thumbnailUri);
        await FileSystem.deleteAsync(thumbnail.uri, { idempotent: true }).catch(() => undefined);
      }

      let uploadedMedia: UploadedMediaFile | null = null;
      let uploadedThumbnail: UploadedMediaFile | null = null;
      try {
        uploadedMedia = await uploadDurableMedia(
          localUri,
          asset.fileName ?? `${id}.${extension}`,
          asset.mimeType ?? (type === 'photo' ? 'image/jpeg' : 'video/mp4'),
          uploadIdFor(id, 'primary')
        );
      } catch (error) {
        // A temporary service outage must not stop a foster parent from using
        // the photo or video in a post. The store reconciles this local copy
        // into durable storage as soon as the service is available again.
        if (!(error instanceof MediaUploadError) || (error.status !== 0 && error.status < 500)) {
          throw error;
        }
      }

      if (type === 'video' && uploadedMedia) {
        try {
          uploadedThumbnail = await uploadDurableMedia(
            thumbnailUri!,
            `${id}-thumbnail.jpg`,
            'image/jpeg',
            uploadIdFor(id, 'thumbnail')
          );
        } catch (error) {
          // Keep the primary upload owned by this media record. The next
          // reconciliation only needs to add the missing thumbnail.
          if (!(error instanceof MediaUploadError) || (error.status !== 0 && error.status < 500)) {
            await removeUploadedMediaOnFailure(uploadedMedia.mediaObjectId);
            throw error;
          }
        }
      }
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      const now = new Date().toISOString();
      return {
        id,
        fosterId,
        type,
        localUri,
        thumbnailUri,
        remoteUri: uploadedMedia?.url ?? null,
        remoteThumbnailUri: type === 'photo'
          ? uploadedMedia?.url ?? null
          : uploadedThumbnail?.url ?? null,
        remoteMediaObjectId: uploadedMedia?.mediaObjectId ?? null,
        remoteThumbnailMediaObjectId: type === 'photo'
          ? uploadedMedia?.mediaObjectId ?? null
          : uploadedThumbnail?.mediaObjectId ?? null,
        metadata: {
          assetId: asset.assetId ?? null,
          fileName: asset.fileName ?? null,
          mimeType: asset.mimeType ?? null,
          originalUri: asset.uri,
          capturedAt: null,
          title: '',
          notes: '',
        },
        tags: [...new Set(tags)],
        favorite: false,
        source,
        dimensions:
          asset.width > 0 && asset.height > 0
            ? { width: asset.width, height: asset.height }
            : null,
        durationMs: type === 'video' ? (asset.duration ?? null) : null,
        sizeBytes: fileInfo.exists && 'size' in fileInfo ? fileInfo.size : (asset.fileSize ?? null),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
    })
  );
}

export async function createDurableMediaCopies(
  media: Pick<MediaItem, 'id' | 'type' | 'localUri' | 'thumbnailUri' | 'remoteUri' | 'remoteThumbnailUri' | 'remoteMediaObjectId' | 'remoteThumbnailMediaObjectId' | 'metadata'>,
  sourceUri = media.localUri
): Promise<Pick<MediaItem, 'remoteUri' | 'remoteThumbnailUri' | 'remoteMediaObjectId' | 'remoteThumbnailMediaObjectId'>> {
  const extension = media.type === 'photo' ? 'jpg' : 'mp4';
  const uploadedMedia = media.remoteUri
    ? null
    : await uploadDurableMedia(
        sourceUri,
        media.metadata.fileName ?? `${media.id}.${extension}`,
        media.metadata.mimeType ?? (media.type === 'photo' ? 'image/jpeg' : 'video/mp4'),
        uploadIdFor(media.id, 'primary')
      );
  const remoteUri = media.remoteUri ?? uploadedMedia!.url;
  const remoteMediaObjectId = media.remoteMediaObjectId ?? uploadedMedia?.mediaObjectId ?? null;

  let uploadedThumbnail = media.remoteThumbnailUri
    ? null
    : media.type === 'photo'
      ? uploadedMedia
      : null;
  if (!media.remoteThumbnailUri && media.type === 'video') {
    try {
      uploadedThumbnail = await uploadDurableMedia(
        media.thumbnailUri ?? sourceUri,
        `${media.id}-thumbnail.jpg`,
        'image/jpeg',
        uploadIdFor(media.id, 'thumbnail')
      );
    } catch (error) {
      if (uploadedMedia) await removeUploadedMediaOnFailure(uploadedMedia.mediaObjectId);
      throw error;
    }
  }
  const remoteThumbnailUri = media.remoteThumbnailUri ?? uploadedThumbnail!.url;
  const remoteThumbnailMediaObjectId = media.remoteThumbnailMediaObjectId
    ?? uploadedThumbnail?.mediaObjectId
    ?? (media.type === 'photo' ? remoteMediaObjectId : null);

  return { remoteUri, remoteThumbnailUri, remoteMediaObjectId, remoteThumbnailMediaObjectId };
}

export function isManagedMediaUri(uri: string | null | undefined): boolean {
  return Boolean(uri && FileSystem.documentDirectory && uri.startsWith(requireDocumentDirectory()));
}

export async function isBrokenMediaUri(uri: string | null | undefined): Promise<boolean> {
  if (!uri) return true;
  if (/^(https?:|data:|blob:)/i.test(uri)) return false;

  try {
    const info = await FileSystem.getInfoAsync(uri);
    return !info.exists || info.isDirectory;
  } catch {
    return true;
  }
}

export function approximateMediaStorageBytes(
  mediaItems: readonly MediaItem[],
  fosterId?: string | null
): number {
  return mediaItems.reduce((total, item) => {
    if (item.deletedAt || (fosterId && item.fosterId !== fosterId)) return total;
    return total + Math.max(0, item.sizeBytes ?? 0);
  }, 0);
}

export async function deleteStoredMediaFiles(media: Pick<MediaItem, 'localUri' | 'thumbnailUri'>): Promise<void> {
  const uris = new Set([media.localUri, media.thumbnailUri].filter((uri): uri is string => Boolean(uri)));
  await Promise.all(
    [...uris]
      .filter(isManagedMediaUri)
      .map((uri) => FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined))
  );
}
