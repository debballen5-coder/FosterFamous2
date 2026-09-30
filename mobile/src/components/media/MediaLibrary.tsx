import { useMutation } from '@tanstack/react-query';
import { Heart, Image as ImageIcon, Plus, Video } from 'lucide-react-native';
import React, { memo, useMemo, useState } from 'react';
import { Modal, Text, useWindowDimensions, View } from 'react-native';

import { MediaThumbnail } from '@/components/MediaThumbnail';
import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/Pressables';
import { cn } from '@/lib/cn';
import { pickMediaFromLibrary } from '@/lib/media-storage';
import { getMediaForFoster, useAppStore } from '@/lib/state/app-store';
import { colors, liftedShadow } from '@/lib/theme';
import type { Foster, MediaItem, MediaType } from '@/lib/types';

const FILTERS = ['All', 'Photos', 'Videos', 'Favorites'] as const;
type MediaFilter = (typeof FILTERS)[number];

function profileReference(foster: Foster): MediaItem | null {
  if (!foster.photoUri) return null;
  const now = new Date().toISOString();
  return {
    id: `profile-${foster.id}`,
    fosterId: foster.id,
    type: 'photo',
    localUri: foster.photoUri,
    thumbnailUri: foster.photoUri,
    metadata: {
      assetId: null,
      fileName: null,
      mimeType: null,
      originalUri: foster.photoUri,
      capturedAt: null,
      title: 'Profile photo',
      notes: '',
    },
    tags: ['profile'],
    favorite: false,
    source: 'profile',
    dimensions: null,
    durationMs: null,
    sizeBytes: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

const MediaTile = memo(function MediaTile({
  item,
  size,
  onPress,
}: {
  item: MediaItem;
  size: number;
  onPress: () => void;
}) {
  return (
    <PressableScale
      testID={`media-tile-${item.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.type}`}
      onPress={onPress}
      scaleTo={0.96}
      style={{ width: size, marginBottom: 8 }}>
      <MediaThumbnail media={item} size={size} testID={`media-thumbnail-${item.id}`} />
    </PressableScale>
  );
});

export function MediaLibrary({
  foster,
  onOpenMedia,
}: {
  foster: Foster;
  onOpenMedia: (mediaId: string) => void;
}) {
  const { width } = useWindowDimensions();
  const mediaItems = useAppStore((state) => state.mediaItems);
  const saveMediaAssets = useAppStore((state) => state.saveMediaAssets);
  const [filter, setFilter] = useState<MediaFilter>('All');
  const [addOpen, setAddOpen] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const storedMedia = useMemo(
    () => getMediaForFoster(mediaItems, foster.id),
    [foster.id, mediaItems]
  );
  const hasStoredProfile = Boolean(
    foster.photoUri &&
      storedMedia.some(
        (item) =>
          item.localUri === foster.photoUri ||
          item.thumbnailUri === foster.photoUri ||
          item.remoteUri === foster.photoUri ||
          item.remoteThumbnailUri === foster.photoUri ||
          item.metadata.originalUri === foster.photoUri
      )
  );
  const virtualProfile = useMemo(
    () => (!hasStoredProfile ? profileReference(foster) : null),
    [foster, hasStoredProfile]
  );
  const library = useMemo(
    () => (virtualProfile ? [virtualProfile, ...storedMedia] : [...storedMedia]),
    [storedMedia, virtualProfile]
  );
  const visibleMedia = useMemo(() => {
    if (filter === 'Photos') return library.filter((item) => item.type === 'photo');
    if (filter === 'Videos') return library.filter((item) => item.type === 'video');
    if (filter === 'Favorites') return library.filter((item) => item.favorite);
    return library;
  }, [filter, library]);

  const photoCount = library.filter((item) => item.type === 'photo').length;
  const videoCount = library.filter((item) => item.type === 'video').length;
  const favoriteCount = library.filter((item) => item.favorite).length;
  const tileSize = Math.floor((Math.min(width, 520) - 56) / 3);

  const addMediaMutation = useMutation({
    mutationFn: async (type: MediaType) => {
      const result = await pickMediaFromLibrary(type);
      if (result.permissionDenied) return { status: 'permission-denied' as const, type, added: 0, needsBackup: false };
      if (result.canceled || result.assets.length === 0) {
        return { status: 'canceled' as const, type, added: 0, needsBackup: false };
      }

      const knownIds = new Set(storedMedia.map((item) => item.id));
      const saved = await saveMediaAssets({ fosterId: foster.id, type, assets: result.assets });
      return {
        status: 'saved' as const,
        type,
        added: saved.filter((item) => !knownIds.has(item.id)).length,
        needsBackup: saved.some(
          (item) => !item.remoteUri || (item.type === 'video' && !item.remoteThumbnailUri)
        ),
      };
    },
    onMutate: () => {
      setError(null);
      setMessage(null);
    },
    onSuccess: ({ status, type, added, needsBackup }) => {
      if (status === 'permission-denied') {
        setError('Allow photo library access to add media.');
        return;
      }
      if (status === 'canceled') return;

      setAddOpen(false);
      setMessage(
        added === 0
          ? 'That media is already in the library.'
          : needsBackup
            ? `${type === 'photo' ? 'Photo' : 'Video'} added on this device. It will back up automatically when the service is available.`
            : added === 1
              ? `${type === 'photo' ? 'Photo' : 'Video'} added to ${foster.name}’s media.`
              : `${added} photos added to ${foster.name}’s media.`
      );
    },
    onError: (issue) => {
      setError(
        issue instanceof Error
          ? issue.message
          : 'We could not add that media. Please try again.'
      );
    },
  });
  const { isPending: isAddingMedia, mutate: chooseMedia, variables: addingType } = addMediaMutation;

  if (foster.isDemo) {
    return (
      <View testID="media-library-demo" className="rounded-3xl border border-hairline bg-white p-5">
        <View className="h-12 w-12 items-center justify-center rounded-2xl bg-beige">
          <ImageIcon size={22} color={colors.forest} strokeWidth={2.2} />
        </View>
        <Text className="mt-4 font-display text-xl text-forest">Media is for your fosters</Text>
        <Text className="mt-2 font-sans text-base leading-[22px] text-ink-muted">
          Add a real foster to build their private photo and video library. Sample pets never store media.
        </Text>
      </View>
    );
  }

  return (
    <View testID="media-library">
      <View className="mb-4 flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text testID="media-library-title" className="font-display text-2xl text-forest">
            {foster.name}’s Media
          </Text>
          <Text className="mt-1 font-sans text-sm text-ink-muted">
            A private library for posts, profiles, and milestones.
          </Text>
        </View>
        <PressableScale
          testID="media-add-button"
          accessibilityRole="button"
          accessibilityLabel="Add media"
          onPress={() => {
            setError(null);
            setAddOpen(true);
          }}
          className="h-12 w-12 items-center justify-center rounded-full bg-clay"
          style={liftedShadow}>
          <Plus size={23} color={colors.white} strokeWidth={2.6} />
        </PressableScale>
      </View>

      <View testID="media-stats" className="mb-4 flex-row gap-2">
        <Stat value={library.length} label="Total" testID="media-stat-total" />
        <Stat value={photoCount} label="Photos" testID="media-stat-photos" />
        <Stat value={videoCount} label="Videos" testID="media-stat-videos" />
        <Stat value={favoriteCount} label="Loved" testID="media-stat-favorites" />
      </View>

      {message ? (
        <View testID="media-confirmation" className="mb-4 rounded-2xl bg-forest-soft px-4 py-3">
          <Text className="font-bold text-sm text-forest">{message}</Text>
        </View>
      ) : null}
      {error ? (
        <View testID="media-error" className="mb-4 rounded-2xl bg-clay-soft px-4 py-3">
          <Text className="font-bold text-sm text-clay-deep">{error}</Text>
        </View>
      ) : null}

      <View testID="media-filters" className="mb-4 flex-row flex-wrap gap-2">
        {FILTERS.map((item) => {
          const active = filter === item;
          return (
            <PressableScale
              key={item}
              testID={`media-filter-${item.toLowerCase()}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setFilter(item)}
              className={cn(
                'h-10 items-center justify-center rounded-full border px-4',
                active ? 'border-forest bg-forest' : 'border-hairline bg-white'
              )}>
              <Text className={cn('font-bold text-sm', active ? 'text-cream' : 'text-ink-soft')}>
                {item}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      {visibleMedia.length > 0 ? (
        <View testID="media-grid" className="flex-row flex-wrap justify-between">
          {visibleMedia.map((item) => (
            <MediaTile
              key={item.id}
              item={item}
              size={tileSize}
              onPress={() => onOpenMedia(item.id)}
            />
          ))}
        </View>
      ) : (
        <View testID="media-empty" className="items-center rounded-3xl border border-dashed border-hairline bg-white/70 px-6 py-10">
          {filter === 'Videos' ? (
            <Video size={24} color={colors.inkMuted} strokeWidth={2} />
          ) : filter === 'Favorites' ? (
            <Heart size={24} color={colors.inkMuted} strokeWidth={2} />
          ) : (
            <ImageIcon size={24} color={colors.inkMuted} strokeWidth={2} />
          )}
          <Text className="mt-3 font-display text-lg text-forest">
            {filter === 'All' ? 'Start the story here' : `No ${filter.toLowerCase()} yet`}
          </Text>
          <Text className="mt-1 text-center font-sans text-sm leading-[20px] text-ink-muted">
            Add clear, honest moments that help adopters get to know {foster.name}.
          </Text>
        </View>
      )}

      <Button
        testID="media-add-wide-button"
        label="Add Media"
        className="mt-4"
        icon={<Plus size={18} color={colors.cream} strokeWidth={2.6} />}
        onPress={() => {
          setError(null);
          setAddOpen(true);
        }}
      />

      <Modal
        testID="media-add-modal"
        visible={addOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAddOpen(false)}>
        <View className="flex-1 justify-end bg-forest-deep/45 px-4 pb-5">
          <View className="rounded-[32px] bg-cream p-5" style={liftedShadow}>
            <View className="mb-5 h-1.5 w-12 self-center rounded-full bg-beige-dark" />
            <Text className="font-display text-2xl text-forest">Add to {foster.name}’s story</Text>
            <Text className="mb-5 mt-1 font-sans text-base text-ink-muted">
              Choose up to 10 photos at once, or add one video.
            </Text>
            <Button
              testID="media-choose-photos"
              label="Choose Photos"
              loading={Boolean(isAddingMedia && addingType === 'photo')}
              disabled={isAddingMedia}
              icon={<ImageIcon size={18} color={colors.cream} strokeWidth={2.4} />}
              onPress={() => void chooseMedia('photo')}
            />
            <Button
              testID="media-choose-video"
              label="Choose Video"
              variant="secondary"
              className="mt-3"
              loading={Boolean(isAddingMedia && addingType === 'video')}
              disabled={isAddingMedia}
              icon={<Video size={18} color={colors.forest} strokeWidth={2.4} />}
              onPress={() => void chooseMedia('video')}
            />
            <Button
              testID="media-add-cancel"
              label="Cancel"
              variant="ghost"
              size="md"
              className="mt-2"
              disabled={isAddingMedia}
              onPress={() => setAddOpen(false)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Stat({ value, label, testID }: { value: number; label: string; testID: string }) {
  return (
    <View testID={testID} className="flex-1 rounded-2xl border border-hairline bg-white px-2 py-3">
      <Text className="text-center font-display text-xl text-forest">{value}</Text>
      <Text className="mt-0.5 text-center font-bold text-[11px] uppercase tracking-[0.7px] text-ink-muted">
        {label}
      </Text>
    </View>
  );
}
