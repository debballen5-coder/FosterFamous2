import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

import type { MediaItem } from './types';

const MIME_TYPES_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  gif: 'image/gif',
  webp: 'image/webp',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  webm: 'video/webm',
};

type ShareableMedia = Pick<MediaItem, 'id' | 'type' | 'localUri' | 'remoteUri' | 'metadata'>;

function filenameExtension(value: string | null | undefined): string | null {
  const extension = value?.split('?')[0]?.match(/\.([a-z0-9]{1,8})$/i)?.[1]?.toLowerCase();
  return extension ?? null;
}

function shareFileExtension(media: ShareableMedia): string {
  return filenameExtension(media.metadata.fileName)
    ?? filenameExtension(media.remoteUri)
    ?? filenameExtension(media.localUri)
    ?? (media.type === 'photo' ? 'jpg' : 'mp4');
}

function mimeTypeForMedia(media: ShareableMedia): string {
  const stored = media.metadata.mimeType?.trim();
  if (stored && /^[-\w.]+\/[-\w.+]+$/i.test(stored)) return stored;

  const extension = shareFileExtension(media);
  return MIME_TYPES_BY_EXTENSION[extension] ?? (media.type === 'photo' ? 'image/jpeg' : 'video/mp4');
}

async function hasLocalFile(uri: string | null | undefined): Promise<boolean> {
  if (!uri || /^(https?:|data:|blob:)/i.test(uri)) return false;

  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists && !info.isDirectory;
  } catch {
    return false;
  }
}

/**
 * A share extension needs a local file. Saved media may have been restored from
 * its durable URL after the original sandbox file was removed, so download that
 * copy to the cache before handing it to the operating system.
 */
export async function resolveShareableMediaUri(media: ShareableMedia): Promise<string | null> {
  if (await hasLocalFile(media.localUri)) return media.localUri;

  const durableUri = media.remoteUri ?? (/^https?:\/\//i.test(media.localUri) ? media.localUri : null);
  if (!durableUri || !FileSystem.cacheDirectory) return null;

  const fileId = media.id.replace(/[^a-zA-Z0-9_-]/g, '-');
  const destination = `${FileSystem.cacheDirectory}foster-famous-share-${fileId}-${Date.now()}.${shareFileExtension(media)}`;

  try {
    const downloaded = await FileSystem.downloadAsync(durableUri, destination);
    return (await hasLocalFile(downloaded.uri)) ? downloaded.uri : null;
  } catch {
    return null;
  }
}

/**
 * Facebook's share extension is more reliable with a conventional local JPEG
 * than HEIC, WebP, or a remote URL. Videos retain their original local format.
 */
export async function prepareMediaForSharing(
  media: ShareableMedia
): Promise<{ uri: string; mimeType: string } | null> {
  const sourceUri = await resolveShareableMediaUri(media);
  if (!sourceUri) return null;

  if (media.type === 'video') {
    return { uri: sourceUri, mimeType: mimeTypeForMedia(media) };
  }

  const jpeg = await ImageManipulator.manipulateAsync(sourceUri, [], {
    format: ImageManipulator.SaveFormat.JPEG,
    compress: 0.95,
  });
  return { uri: jpeg.uri, mimeType: 'image/jpeg' };
}
