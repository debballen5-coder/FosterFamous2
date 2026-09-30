import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import { VideoView, useVideoPlayer } from 'expo-video';
import { format } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Check,
  Heart,
  ImageOff,
  PawPrint,
  Share2,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/Pressables';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { cn } from '@/lib/cn';
import { contentPostMediaIds, normalizeContentPostMedia } from '@/lib/content-post-media';
import { isBrokenMediaUri, mediaUri } from '@/lib/media-storage';
import { prepareMediaForSharing } from '@/lib/media-sharing';
import { MEDIA_CATEGORY_TAGS } from '@/lib/options';
import {
  findFoster,
  findMediaItem,
  useAppStore,
  useDisplayFosters,
} from '@/lib/state/app-store';
import { colors, liftedShadow } from '@/lib/theme';
import type { Foster, MediaCategoryTag, MediaItem } from '@/lib/types';

function profileReference(foster: Foster, id: string): MediaItem | null {
  if (id !== `profile-${foster.id}` || !foster.photoUri) return null;
  const now = new Date().toISOString();
  return {
    id,
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

function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
  });

  return (
    <VideoView
      testID="media-detail-video"
      player={player}
      nativeControls
      contentFit="contain"
      style={{ width: '100%', height: 390, backgroundColor: colors.forestDeep }}
    />
  );
}

export default function MediaDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; fosterId?: string }>();
  const mediaItems = useAppStore((state) => state.mediaItems);
  const contentPosts = useAppStore((state) => state.contentPosts);
  const updateMediaDetails = useAppStore((state) => state.updateMediaDetails);
  const toggleMediaFavorite = useAppStore((state) => state.toggleMediaFavorite);
  const deleteMediaItem = useAppStore((state) => state.deleteMediaItem);
  const setFosterProfilePhotoFromMedia = useAppStore(
    (state) => state.setFosterProfilePhotoFromMedia
  );
  const setFosterSuccessStoryPhoto = useAppStore(
    (state) => state.setFosterSuccessStoryPhoto
  );
  const updateFoster = useAppStore((state) => state.updateFoster);
  const updateContentPost = useAppStore((state) => state.updateContentPost);
  const fosters = useDisplayFosters();
  const storedMedia = findMediaItem(mediaItems, params.id, true);
  const foster = findFoster(fosters, storedMedia?.fosterId ?? params.fosterId);
  const media = useMemo(
    () => storedMedia ?? (params.id ? profileReference(foster, params.id) : null),
    [foster, params.id, storedMedia]
  );
  const isVirtualProfile = Boolean(media && !storedMedia && media.id.startsWith('profile-'));
  const displayUri = media ? mediaUri(media) : null;
  const [title, setTitle] = useState<string>(media?.metadata.title ?? '');
  const [notes, setNotes] = useState<string>(media?.metadata.notes ?? '');
  const [tags, setTags] = useState<MediaCategoryTag[]>(media?.tags ?? []);
  const [broken, setBroken] = useState<boolean>(Boolean(media?.deletedAt));
  const [deleteOpen, setDeleteOpen] = useState<boolean>(false);
  const [shareChoiceOpen, setShareChoiceOpen] = useState<boolean>(false);
  const [sharing, setSharing] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!media) return;
    setTitle(media.metadata.title);
    setNotes(media.metadata.notes);
    setTags(media.tags);
  }, [media]);

  useEffect(() => {
    if (!media || media.deletedAt) {
      setBroken(true);
      return;
    }
    let active = true;
    void isBrokenMediaUri(displayUri).then((result) => {
      if (active) setBroken(result);
    });
    return () => {
      active = false;
    };
  }, [displayUri, media]);

  const usageCount = useMemo(() => {
    if (!media) return contentPosts.filter((post) => contentPostMediaIds(post).includes(params.id ?? '')).length;
    return contentPosts.filter(
      (post) =>
        contentPostMediaIds(post).includes(media.id) ||
        post.sourceUri === media.localUri ||
        post.sourceUri === media.thumbnailUri
    ).length;
  }, [contentPosts, media, params.id]);

  const availableTags = useMemo(
    () => MEDIA_CATEGORY_TAGS.filter((option) => media && option.mediaTypes.includes(media.type)),
    [media]
  );

  const removeReference = async () => {
    if (storedMedia && !storedMedia.deletedAt) {
      const deleted = await deleteMediaItem(storedMedia.id);
      if (!deleted) {
        setMessage('We could not remove the cloud copy yet. Please try again.');
        return;
      }
    } else {
      const profileUri = isVirtualProfile ? foster.photoUri : null;
      if (isVirtualProfile) updateFoster(foster.id, { photoUri: null });
      contentPosts
        .filter(
          (post) =>
            contentPostMediaIds(post).includes(params.id ?? '') ||
            (Boolean(profileUri) && post.sourceUri === profileUri)
        )
        .forEach((post) => {
          const normalized = normalizeContentPostMedia(
            contentPostMediaIds(post).filter((mediaId) => mediaId !== params.id)
          );
          const nextMedia = findMediaItem(mediaItems, normalized.primaryMediaId);
          updateContentPost(post.id, {
            ...normalized,
            sourceUri: nextMedia ? mediaUri(nextMedia) : null,
          });
        });
    }
    router.back();
  };

  if (!media) {
    return (
      <Screen testID="media-detail-missing-screen">
        <ScreenHeader title="Media unavailable" />
        <View className="flex-1 items-center justify-center px-7 pb-20">
          <View className="h-20 w-20 items-center justify-center rounded-3xl bg-beige">
            <ImageOff size={34} color={colors.inkMuted} strokeWidth={2} />
          </View>
          <Text className="mt-5 text-center font-display text-2xl text-forest">
            This media reference is broken
          </Text>
          <Text className="mt-2 text-center font-sans text-base leading-[22px] text-ink-muted">
            The original file is no longer available. You can safely remove its saved reference.
          </Text>
          <Button
            testID="media-remove-missing-reference"
            label="Remove Reference"
            variant="accent"
            className="mt-6"
            onPress={() => void removeReference()}
          />
        </View>
      </Screen>
    );
  }

  const capturedAt = media.metadata.capturedAt ?? media.createdAt;
  const displayDate = (() => {
    try {
      return format(new Date(capturedAt), 'MMMM d, yyyy');
    } catch {
      return 'Date unavailable';
    }
  })();

  const toggleTag = (tag: MediaCategoryTag) => {
    setTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]
    );
  };

  const saveDetails = () => {
    if (!isVirtualProfile) updateMediaDetails(media.id, { title, notes, tags });
    setMessage('Media details saved.');
  };

  const confirmDelete = async () => {
    setDeleting(true);
    await removeReference();
    setDeleting(false);
  };

  const shareMediaOnly = async () => {
    if (!media || broken) return;
    setSharing(true);
    try {
      if (!(await Sharing.isAvailableAsync())) {
        setMessage('Sharing is not available on this device.');
        return;
      }
      const shareFile = await prepareMediaForSharing(media);
      if (!shareFile) {
        setMessage('This saved media is unavailable. It was not shared.');
        return;
      }
      await Sharing.shareAsync(shareFile.uri, {
        dialogTitle: `Share ${foster.name}'s ${media.type}`,
        mimeType: shareFile.mimeType,
      });
      setShareChoiceOpen(false);
      setMessage('Media sharing opened. Nothing was marked posted.');
    } catch {
      setMessage('We could not open sharing. Your media is still safe.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <Screen testID="media-detail-screen" edges={['top', 'bottom']}>
      <ScreenHeader
        title={`${foster.name}’s Media`}
        subtitle={media.type === 'photo' ? 'Photo details' : 'Video details'}
        right={
          <PressableScale
            testID="media-favorite-button"
            accessibilityRole="button"
            accessibilityLabel={media.favorite ? 'Remove favorite' : 'Add favorite'}
            accessibilityState={{ selected: media.favorite }}
            disabled={isVirtualProfile || broken}
            onPress={() => toggleMediaFavorite(media.id)}
            className="h-11 w-11 items-center justify-center rounded-full border border-hairline bg-white">
            <Heart
              size={20}
              color={media.favorite ? colors.clay : colors.forest}
              fill={media.favorite ? colors.clay : 'transparent'}
              strokeWidth={2.3}
            />
          </PressableScale>
        }
      />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 36 }}>
          <View testID="media-detail-viewer" className="mx-5 overflow-hidden rounded-[28px] bg-forest-deep" style={liftedShadow}>
            {broken ? (
              <View testID="media-detail-broken" className="h-[390px] items-center justify-center bg-beige px-7">
                <ImageOff size={38} color={colors.inkMuted} strokeWidth={2} />
                <Text className="mt-4 text-center font-display text-xl text-forest">File unavailable</Text>
                <Text className="mt-1 text-center font-sans text-sm leading-[20px] text-ink-muted">
                  The saved reference remains, but the original file cannot be opened.
                </Text>
                <Button
                  testID="media-remove-broken-reference"
                  label="Remove Reference"
                  variant="accent"
                  size="md"
                  className="mt-5"
                  onPress={() => void removeReference()}
                />
              </View>
            ) : media.type === 'video' && displayUri ? (
              <VideoPreview uri={displayUri} />
            ) : displayUri ? (
              <Image
                testID="media-detail-photo"
                source={{ uri: displayUri }}
                style={{ width: '100%', height: 390 }}
                contentFit="contain"
                transition={180}
                onError={() => setBroken(true)}
              />
            ) : null}
          </View>

          <View className="px-5 pt-5">
            {message ? (
              <View testID="media-detail-confirmation" className="mb-4 rounded-2xl bg-forest-soft px-4 py-3">
                <Text className="font-bold text-sm text-forest">{message}</Text>
              </View>
            ) : null}

            <View testID="media-detail-metadata" className="mb-5 flex-row gap-2">
              <View className="flex-1 rounded-2xl border border-hairline bg-white p-3.5">
                <Text className="font-extrabold text-[11px] uppercase tracking-[1px] text-ink-muted">Foster</Text>
                <Text className="mt-1 font-bold text-base text-ink" numberOfLines={1}>{foster.name}</Text>
              </View>
              <View className="flex-1 rounded-2xl border border-hairline bg-white p-3.5">
                <Text className="font-extrabold text-[11px] uppercase tracking-[1px] text-ink-muted">Added</Text>
                <Text className="mt-1 font-bold text-sm text-ink" numberOfLines={1}>{displayDate}</Text>
              </View>
              <View className="flex-1 rounded-2xl border border-hairline bg-white p-3.5">
                <Text className="font-extrabold text-[11px] uppercase tracking-[1px] text-ink-muted">Used</Text>
                <Text className="mt-1 font-bold text-base text-ink">{usageCount} posts</Text>
              </View>
            </View>

            <Text className="mb-2 font-extrabold text-xs uppercase tracking-[1.3px] text-ink-muted">
              What’s happening?
            </Text>
            <TextInput
              testID="media-caption-input"
              value={title}
              onChangeText={setTitle}
              editable={!isVirtualProfile}
              placeholder={`Describe this ${media.type}`}
              placeholderTextColor={colors.inkMuted}
              className="min-h-[84px] rounded-2xl border border-hairline bg-white px-4 py-3 font-sans text-base text-ink"
              style={{ textAlignVertical: 'top' }}
              multiline
            />

            <Text className="mb-2 mt-5 font-extrabold text-xs uppercase tracking-[1.3px] text-ink-muted">
              Private notes
            </Text>
            <TextInput
              testID="media-notes-input"
              value={notes}
              onChangeText={setNotes}
              editable={!isVirtualProfile}
              placeholder="Anything you want to remember"
              placeholderTextColor={colors.inkMuted}
              className="min-h-[104px] rounded-2xl border border-hairline bg-white px-4 py-3 font-sans text-base text-ink"
              style={{ textAlignVertical: 'top' }}
              multiline
            />

            <Text className="mb-2 mt-5 font-extrabold text-xs uppercase tracking-[1.3px] text-ink-muted">
              Tags
            </Text>
            <View testID="media-tags" className="flex-row flex-wrap gap-2">
              {availableTags.map((option) => {
                const selected = tags.includes(option.id);
                return (
                  <PressableScale
                    key={option.id}
                    testID={`media-tag-${option.id}`}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    disabled={isVirtualProfile}
                    onPress={() => toggleTag(option.id)}
                    className={cn(
                      'min-h-10 flex-row items-center rounded-full border px-3.5 py-2',
                      selected ? 'border-forest bg-forest' : 'border-hairline bg-white'
                    )}>
                    {selected ? <Check size={14} color={colors.cream} strokeWidth={2.8} /> : null}
                    <Text className={cn('font-bold text-sm', selected ? 'ml-1.5 text-cream' : 'text-ink-soft')}>
                      {option.label}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>

            {isVirtualProfile ? (
              <View testID="media-profile-importing" className="mt-5 rounded-2xl bg-beige px-4 py-3">
                <Text className="font-sans text-sm leading-[20px] text-ink-soft">
                  This existing profile photo is being added to the media library. Details will be editable after import.
                </Text>
              </View>
            ) : (
              <Button
                testID="media-save-button"
                label="Save Details"
                className="mt-5"
                icon={<Check size={18} color={colors.cream} strokeWidth={2.5} />}
                onPress={saveDetails}
              />
            )}

            {!isVirtualProfile && !broken ? (
              <Button
                testID="media-create-post-from-this"
                label="Create Post From This"
                variant="accent"
                className="mt-3"
                icon={<Sparkles size={18} color={colors.white} strokeWidth={2.4} />}
                onPress={() =>
                  router.push({
                    pathname: '/create/editor',
                    params: { kind: 'Social Media Post', fosterId: foster.id, mediaId: media.id },
                  })
                }
              />
            ) : null}

            {!isVirtualProfile && !broken ? (
              <Button
                testID="media-share-button"
                label="Share"
                variant="secondary"
                className="mt-3"
                icon={<Share2 size={18} color={colors.forest} strokeWidth={2.4} />}
                onPress={() => setShareChoiceOpen(true)}
              />
            ) : null}

            {media.type === 'photo' && !isVirtualProfile && !broken ? (
              <Button
                testID="media-set-profile-photo"
                label="Set as Profile Photo"
                variant="secondary"
                className="mt-3"
                icon={<PawPrint size={18} color={colors.forest} strokeWidth={2.4} />}
                onPress={() => {
                  if (setFosterProfilePhotoFromMedia(foster.id, media.id)) {
                    setMessage(`Now using this photo for ${foster.name}’s profile.`);
                  }
                }}
              />
            ) : null}

            {media.type === 'photo' && foster.adoptionStatus === 'Adopted' && !isVirtualProfile && !broken ? (
              <Button
                testID="media-set-success-photo"
                label="Set as Success Story Photo"
                variant="outline"
                className="mt-3"
                icon={<Star size={18} color={colors.forest} strokeWidth={2.3} />}
                onPress={() => {
                  if (setFosterSuccessStoryPhoto(foster.id, media.id)) {
                    setMessage('Success story photo updated.');
                  }
                }}
              />
            ) : null}

            {!isVirtualProfile ? (
              <Button
                testID="media-delete-button"
                label="Delete Media"
                variant="ghost"
                className="mt-3"
                icon={<Trash2 size={17} color={colors.forest} strokeWidth={2.2} />}
                onPress={() => setDeleteOpen(true)}
              />
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        testID="media-share-choice-modal"
        visible={shareChoiceOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setShareChoiceOpen(false)}>
        <View className="flex-1 justify-end bg-forest-deep/55 px-4 pb-5">
          <View className="rounded-[32px] bg-cream p-5" style={liftedShadow}>
            <View className="mb-4 h-1.5 w-12 self-center rounded-full bg-beige-dark" />
            <Text className="font-display text-2xl text-forest">Share this media?</Text>
            <Text className="mt-2 font-sans text-base leading-[22px] text-ink-muted">
              Want Foster Famous to write the post first? A caption makes sharing easier, but it is optional.
            </Text>
            <Button
              testID="media-share-create-caption"
              label="Create Caption"
              className="mt-5"
              icon={<Sparkles size={18} color={colors.cream} strokeWidth={2.4} />}
              onPress={() => {
                setShareChoiceOpen(false);
                router.push({
                  pathname: '/create/editor',
                  params: { kind: 'Social Media Post', fosterId: foster.id, mediaId: media.id },
                });
              }}
            />
            <Button
              testID="media-share-only"
              label="Share Media Only"
              variant="secondary"
              className="mt-3"
              loading={sharing}
              icon={<Share2 size={18} color={colors.forest} strokeWidth={2.4} />}
              onPress={() => void shareMediaOnly()}
            />
            <Button
              testID="media-share-cancel"
              label="Cancel"
              variant="ghost"
              size="md"
              className="mt-2"
              disabled={sharing}
              onPress={() => setShareChoiceOpen(false)}
            />
          </View>
        </View>
      </Modal>

      <Modal
        testID="media-delete-modal"
        visible={deleteOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteOpen(false)}>
        <View className="flex-1 items-center justify-center bg-forest-deep/55 px-5">
          <View className="w-full max-w-[430px] rounded-[30px] bg-cream p-5" style={liftedShadow}>
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-clay-soft">
              <Trash2 size={22} color={colors.clayDeep} strokeWidth={2.3} />
            </View>
            <Text className="mt-4 font-display text-2xl text-forest">Delete this media?</Text>
            <Text className="mt-2 font-sans text-base leading-[22px] text-ink-soft">
              {usageCount > 0
                ? `It is used in ${usageCount} saved ${usageCount === 1 ? 'post' : 'posts'}. Deleting it removes those media references but keeps the written posts.`
                : 'This removes the file from the library and cannot be undone.'}
            </Text>
            <Button
              testID="media-confirm-delete"
              label={usageCount > 0 ? `Delete from ${usageCount} ${usageCount === 1 ? 'Post' : 'Posts'}` : 'Delete Media'}
              variant="accent"
              className="mt-5"
              loading={deleting}
              onPress={() => void confirmDelete()}
            />
            <Button
              testID="media-cancel-delete"
              label="Keep Media"
              variant="secondary"
              className="mt-3"
              disabled={deleting}
              onPress={() => setDeleteOpen(false)}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
