import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Share2 } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Modal, ScrollView, Share, Text, View } from 'react-native';

import { MediaThumbnail } from '@/components/MediaThumbnail';
import { MediaPickerSheet } from '@/components/media/MediaPickerSheet';
import { Button, TinyButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PressableScale } from '@/components/ui/Pressables';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { contentPostMediaIds, normalizeContentPostMedia } from '@/lib/content-post-media';
import { isContentPostStale } from '@/lib/foster-current-info';
import { mediaUri, pickMediaFromLibrary } from '@/lib/media-storage';
import { prepareMediaForSharing } from '@/lib/media-sharing';
import {
  prepareShareContent,
  prioritizedPlatforms,
  SHARE_PLATFORMS,
  type SharePlatform,
} from '@/lib/share-content';
import {
  findContentPost,
  findFoster,
  findMediaItem,
  getMediaForFoster,
  useAppStore,
  useDisplayFosters,
} from '@/lib/state/app-store';
import { colors, liftedShadow } from '@/lib/theme';
import type { MediaItem, MediaType } from '@/lib/types';

function PlatformButton({
  platform,
  selected,
  onPress,
  testID,
}: {
  platform: SharePlatform;
  selected: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={selected ? 'mb-2 rounded-2xl border-2 border-forest bg-forest p-4' : 'mb-2 rounded-2xl border border-hairline bg-white p-4'}>
      <View className="flex-row items-center justify-between">
        <Text className={selected ? 'font-bold text-lg text-cream' : 'font-bold text-lg text-ink'}>
          {platform}
        </Text>
        {selected ? <Check size={19} color={colors.cream} strokeWidth={3} /> : null}
      </View>
    </PressableScale>
  );
}

function MissingPost() {
  const router = useRouter();
  return (
    <Screen testID="share-missing-post-screen">
      <ScreenHeader title="Content unavailable" onBack={() => router.back()} />
      <View className="flex-1 items-center justify-center px-7 pb-20">
        <Text className="text-center font-display text-2xl text-forest">This saved post is unavailable.</Text>
        <Text className="mt-2 text-center font-sans text-base leading-[22px] text-ink-muted">
          It may have been deleted. Your other saved content is still safe.
        </Text>
        <Button testID="share-missing-post-back" label="Go Back" className="mt-6" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

export default function SharePostScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ postId?: string }>();
  const fosters = useDisplayFosters();
  const contentPosts = useAppStore((state) => state.contentPosts);
  const mediaItems = useAppStore((state) => state.mediaItems);
  const saveMediaAssets = useAppStore((state) => state.saveMediaAssets);
  const ensureContentPostMedia = useAppStore((state) => state.ensureContentPostMedia);
  const updateContentPost = useAppStore((state) => state.updateContentPost);
  const recordPublication = useAppStore((state) => state.recordPublication);
  const setFosterPlanTaskStatus = useAppStore((state) => state.setFosterPlanTaskStatus);

  const post = findContentPost(contentPosts, params.postId);
  const foster = findFoster(fosters, post?.petId);
  const attachmentIds = contentPostMediaIds(post);
  const attachedMediaItems = attachmentIds
    .map((mediaId) => findMediaItem(mediaItems, mediaId))
    .filter((media): media is MediaItem => Boolean(media && media.fosterId === post?.petId));
  const attachedMedia = attachedMediaItems[0];
  const fosterMedia = useMemo(() => getMediaForFoster(mediaItems, foster.id), [foster.id, mediaItems]);
  const [platform, setPlatform] = useState<SharePlatform | null>(null);
  const [mediaPickerOpen, setMediaPickerOpen] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState<boolean>(false);
  const [confirmationOpen, setConfirmationOpen] = useState<boolean>(false);
  const [platformsPosted, setPlatformsPosted] = useState<SharePlatform[]>([]);
  const [planConfirmOpen, setPlanConfirmOpen] = useState<boolean>(false);
  const [recorded, setRecorded] = useState<boolean>(false);
  const [nativeShareComplete, setNativeShareComplete] = useState<boolean>(false);
  const nativeSharePending = useRef<boolean>(false);
  const nativeShareBackgrounded = useRef<boolean>(false);
  const nativeShareExpiry = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (!nativeSharePending.current) return;

      if (nextAppState === 'background') {
        nativeShareBackgrounded.current = true;
        return;
      }
      if (nextAppState !== 'active' || !nativeShareBackgrounded.current) return;

      nativeSharePending.current = false;
      nativeShareBackgrounded.current = false;
      if (nativeShareExpiry.current) clearTimeout(nativeShareExpiry.current);
      nativeShareExpiry.current = null;

      // Some social apps leave the native share promise unresolved after they
      // return. Restore our controls without showing a modal over the handoff.
      setSharing(false);
      setNativeShareComplete(true);
      setNotice('Back from sharing? Save the post below when you are ready.');
    });

    return () => {
      subscription.remove();
      if (nativeShareExpiry.current) clearTimeout(nativeShareExpiry.current);
    };
  }, []);

  if (!post) return <MissingPost />;

  if (foster.adoptionStatus === 'Adopted') {
    return (
      <Screen testID="share-adopted-foster-screen" edges={['top']}>
        <ScreenHeader title="Marketing archived" onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center px-7 pb-20">
          <Text className="text-center font-display text-2xl text-forest">{foster.name}'s marketing is paused.</Text>
          <Text className="mt-2 text-center font-sans text-base leading-[22px] text-ink-muted">
            This saved post is preserved, but sharing and posting are paused while this foster is adopted. Reactivate the profile if they return.
          </Text>
          <Button testID="share-adopted-foster-back" label="View Saved Content" className="mt-6" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const prepared = platform ? prepareShareContent(post, foster, platform) : null;
  const adoptionLink = prepared?.adoptionLink ?? null;
  const stalePost = isContentPostStale(post, foster);
  const visiblePlatforms = prioritizedPlatforms(post);

  const copy = async (value: string, label: string) => {
    if (!value.trim()) return;
    await Clipboard.setStringAsync(value);
    setNotice(`${label} copied`);
    setError(null);
  };

  const attachMedia = (media: MediaItem) => {
    if (media.fosterId !== post.petId) return;
    const normalized = normalizeContentPostMedia([media.id], media.id);
    updateContentPost(post.id, {
      ...normalized,
      sourceUri: mediaUri(media),
      sourceType: media.type,
    });
    setMediaPickerOpen(false);
    setNotice(`${media.type === 'photo' ? 'Photo' : 'Video'} attached`);
  };

  const attachPhotos = (media: MediaItem[]) => {
    const normalized = normalizeContentPostMedia(
      media.filter((item) => item.fosterId === post.petId && item.type === 'photo').map((item) => item.id)
    );
    const primary = findMediaItem(mediaItems, normalized.primaryMediaId);
    if (normalized.mediaIds.length === 0 || !primary) return;
    updateContentPost(post.id, {
      ...normalized,
      sourceUri: mediaUri(primary),
      sourceType: 'photo',
    });
    setMediaPickerOpen(false);
    setNotice(`${normalized.mediaIds.length} ${normalized.mediaIds.length === 1 ? 'photo' : 'photos'} attached`);
  };

  const addNewMedia = async (type: MediaType) => {
    setError(null);
    const result = await pickMediaFromLibrary(type, type === 'photo' ? 10 : 1);
    if (result.permissionDenied) {
      setError('Allow photo-library access to add media.');
      return;
    }
    if (result.canceled || result.assets.length === 0) return;
    try {
      const stored = await saveMediaAssets({
        fosterId: post.petId,
        type,
        assets: result.assets,
        source: 'content-builder',
      });
      if (stored.length === 0) throw new Error('The media could not be saved.');
      if (type === 'photo') attachPhotos(stored);
      else if (stored[0]) attachMedia(stored[0]);
    } catch {
      setError('We could not add that media. Your draft is still saved.');
    }
  };

  const beginNativeShareHandoff = () => {
    nativeSharePending.current = true;
    nativeShareBackgrounded.current = false;
    if (nativeShareExpiry.current) clearTimeout(nativeShareExpiry.current);
    nativeShareExpiry.current = setTimeout(() => {
      nativeSharePending.current = false;
      nativeShareBackgrounded.current = false;
      nativeShareExpiry.current = null;
    }, 2 * 60 * 1000);
  };

  const clearNativeShareHandoff = () => {
    nativeSharePending.current = false;
    nativeShareBackgrounded.current = false;
    if (nativeShareExpiry.current) clearTimeout(nativeShareExpiry.current);
    nativeShareExpiry.current = null;
  };

  const openNativeShare = async () => {
    const selectedPlatform = platform;
    if (!prepared || !selectedPlatform) return;
    setError(null);
    setSharing(true);
    try {
      // Normalize legacy URI-only records immediately before opening the system
      // sheet, then resolve the current media record rather than a stale render.
      const expectsAttachment =
        (post.sourceType === 'photo' || post.sourceType === 'video') &&
        Boolean(attachmentIds.length || post.sourceUri);
      const normalized = expectsAttachment ? await ensureContentPostMedia(post.id) : true;
      const latestState = useAppStore.getState();
      const latestPost = findContentPost(latestState.contentPosts, post.id) ?? post;
      const latestAttachments = contentPostMediaIds(latestPost)
        .map((mediaId) => findMediaItem(latestState.mediaItems, mediaId))
        .filter((media): media is MediaItem => Boolean(
          media && media.fosterId === latestPost.petId && media.deletedAt === null
        ));
      const shareMedia = latestAttachments[0];
      const shareFile = shareMedia ? await prepareMediaForSharing(shareMedia) : null;
      if (expectsAttachment && (!normalized || latestAttachments.length !== contentPostMediaIds(latestPost).length || !shareMedia || !shareFile)) {
        setError('One or more saved attachments are unavailable. Choose a replacement or share this post without media — nothing was marked posted.');
        setMediaPickerOpen(true);
        return;
      }

      // Keep any return UI non-blocking. Instagram can briefly activate our app
      // while its post composer is still opening, so this screen must never present
      // a modal during the handoff.
      setNativeShareComplete(false);

      if (shareFile) {
        // iOS and Android social apps do not consistently accept text plus a file.
        // Copy first so the foster parent can paste a reviewed caption after their app opens.
        await Clipboard.setStringAsync(prepared.shareText);
        await new Promise<void>((resolve) => setTimeout(resolve, 180));
        const available = await Sharing.isAvailableAsync();
        if (!available) {
          setError('Media sharing is unavailable on this device. Your caption was copied.');
          return;
        }
        beginNativeShareHandoff();
        await Sharing.shareAsync(shareFile.uri, {
          dialogTitle: `Share ${foster.name}'s media`,
          mimeType: shareFile.mimeType,
        });
      } else {
        beginNativeShareHandoff();
        const result = await Share.share({ title: prepared.title, message: prepared.shareText });
        if (result.action === Share.dismissedAction) {
          clearNativeShareHandoff();
          setNotice('Share canceled — nothing was marked posted.');
          return;
        }
      }

      // A share extension can finish without switching apps. Keep a calm manual
      // confirmation available in that case instead of immediately showing a modal.
      setNativeShareComplete(true);
      setNotice(
        latestAttachments.length > 1
          ? `The cover photo opened in ${selectedPlatform}. Add the other ${latestAttachments.length - 1} saved ${latestAttachments.length === 2 ? 'photo' : 'photos'} there, then return when you’re ready to save it.`
          : `Finish your post in ${selectedPlatform}, then return here when you’re ready to save it.`
      );
    } catch {
      clearNativeShareHandoff();
      setError('We could not open sharing. Your saved post is still here.');
    } finally {
      setSharing(false);
    }
  };

  const togglePostedPlatform = (item: SharePlatform) => {
    setPlatformsPosted((current) =>
      current.includes(item) ? current.filter((platformItem) => platformItem !== item) : [...current, item]
    );
  };

  const confirmPosted = () => {
    const records = recordPublication(post.id, platformsPosted);
    if (records.length === 0) return;
    setConfirmationOpen(false);
    setRecorded(true);
    setNotice(
      records.length === 1
        ? `Recorded as posted to ${records[0]?.platform ?? 'your selected platform'}`
        : `Recorded as posted to ${records.length} platforms`
    );
    if (post.planDay) setPlanConfirmOpen(true);
  };

  const finishPlanDecision = (complete: boolean) => {
    if (complete && post.planDay) {
      setFosterPlanTaskStatus(foster.id, post.planDay, 'done', post.id);
    }
    setPlanConfirmOpen(false);
    setNotice(complete && post.planDay ? `Day ${post.planDay} marked complete` : 'Posting saved');
  };

  if (recorded) {
    return (
      <Screen testID="share-recorded-screen" edges={['top']}>
        <ScreenHeader title="Posting saved" onBack={() => router.back()} />
        <View className="flex-1 justify-center px-5 pb-16">
          <View className="items-center rounded-[34px] bg-forest p-7" style={liftedShadow}>
            <View className="h-16 w-16 items-center justify-center rounded-full bg-cream/15">
              <Check size={32} color={colors.cream} strokeWidth={3} />
            </View>
            <Text className="mt-5 text-center font-display text-3xl text-cream">Nice work! 🐾</Text>
            <Text className="mt-2 text-center font-sans text-lg leading-[25px] text-cream/80">
              {foster.name} was shared today. Foster Famous saved this in the marketing history.
            </Text>
          </View>
          <Button testID="share-recorded-done" label="Done" className="mt-5" onPress={() => router.back()} />
        </View>
        <PlanCompletionModal
          visible={planConfirmOpen}
          day={post.planDay}
          onChoose={finishPlanDecision}
        />
      </Screen>
    );
  }

  return (
    <Screen testID="share-post-screen" edges={['top']}>
      <ScreenHeader
        title={platform ? 'Ready to Share' : 'Share / Post'}
        subtitle={platform ? `${foster.name} · ${platform}` : `Choose where to share ${foster.name}`}
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
        <View className="flex-1">
        {!platform ? (
          <View className="flex-1">
            <Text className="mt-3 font-display text-3xl leading-[39px] text-forest">Where do you want to share this?</Text>
            <Text className="mb-5 mt-2 font-sans text-base leading-[22px] text-ink-muted">
              We’ll prepare the version you already reviewed. Foster Famous never posts automatically.
            </Text>
            {visiblePlatforms.map((item) => (
              <PlatformButton
                key={item}
                platform={item}
                selected={false}
                testID={`share-platform-${item.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                onPress={() => {
                  clearNativeShareHandoff();
                  setNativeShareComplete(false);
                  setPlatform(item);
                  setNotice(null);
                  setError(null);
                }}
              />
            ))}
          </View>
        ) : (
          <View className="flex-1">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="font-display text-2xl text-forest">{platform}</Text>
              <TinyButton
                testID="share-change-platform"
                label="Change"
                onPress={() => {
                  clearNativeShareHandoff();
                  setNativeShareComplete(false);
                  setPlatform(null);
                }}
              />
            </View>

            {stalePost ? (
              <Card testID="share-stale-draft-warning" tone="clay" className="mb-3" raised={false}>
                <Text className="font-bold text-base text-clay-deep">This post may use older foster information.</Text>
                <Text className="mt-1 font-sans text-sm leading-[20px] text-clay-deep">Edit or refresh it with the latest Current Status before sharing.</Text>
                <TinyButton testID="share-refresh-current-info" label="Edit / Refresh" onPress={() => router.push({ pathname: '/create/editor', params: { draftId: post.id } })} />
              </Card>
            ) : null}
            {attachedMedia ? (
              <Card tone="white" className="mb-3" raised={false}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ flexGrow: 0 }}
                  contentContainerStyle={{ gap: 8 }}>
                  {attachedMediaItems.map((media, index) => (
                    <View key={media.id} className="relative">
                      <MediaThumbnail
                        media={media}
                        size={90}
                        testID={index === 0 ? 'share-media-preview' : `share-media-preview-${index + 1}`}
                      />
                      {index === 0 && attachedMediaItems.length > 1 ? (
                        <View className="absolute bottom-1 left-1 rounded-full bg-forest px-2 py-1">
                          <Text className="font-bold text-[10px] text-cream">Cover</Text>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </ScrollView>
                <View className="mt-3">
                  <Text className="font-bold text-base text-forest">
                    {attachedMediaItems.length > 1 ? `${attachedMediaItems.length} photos attached` : 'Media attached'}
                  </Text>
                  <Text className="mt-1 font-sans text-sm leading-[19px] text-ink-muted">
                    {attachedMediaItems.length > 1
                      ? 'The cover photo opens first. Your other saved photos stay ready to add in the social app.'
                      : `We’ll use this saved ${attachedMedia.type} — no duplicate file needed.`}
                  </Text>
                  <TinyButton testID="share-change-media" label="Change media" onPress={() => setMediaPickerOpen(true)} />
                </View>
              </Card>
            ) : (
              <Card tone="beige" className="mb-3" raised={false}>
                <Text className="font-bold text-lg text-forest">Add a photo or video?</Text>
                <Text className="mt-1 font-sans text-sm leading-[20px] text-ink-muted">
                  A visual can help this post stand out, but you can continue with text only.
                </Text>
                <View className="mt-3 flex-row flex-wrap gap-2">
                  <TinyButton testID="share-choose-foster-media" label={`Choose ${foster.name}'s Media`} tone="forest" onPress={() => setMediaPickerOpen(true)} />
                  <TinyButton testID="share-add-photo" label="Add New Photos" onPress={() => void addNewMedia('photo')} />
                  <TinyButton testID="share-add-video" label="Add New Video" onPress={() => void addNewMedia('video')} />
                  <TinyButton testID="share-without-media" label="Continue Without Media" onPress={() => setNotice('Text-only share selected')} />
                </View>
              </Card>
            )}

            <Card tone="white" className="mb-3" raised={false}>
              <Text className="font-extrabold text-xs uppercase tracking-[1.2px] text-clay-deep">
                {prepared?.overlayText ? 'Suggested overlay text' : 'Caption preview'}
              </Text>
              <Text testID="share-caption-preview" className="mt-2 font-sans text-base leading-[23px] text-ink">
                {prepared?.caption}
              </Text>
              {prepared?.callToAction ? (
                <>
                  <Text className="mt-4 font-extrabold text-xs uppercase tracking-[1.2px] text-clay-deep">Call to action</Text>
                  <Text testID="share-cta-preview" className="mt-1 font-sans text-base leading-[23px] text-ink">{prepared.callToAction}</Text>
                </>
              ) : null}
              {prepared?.hashtags.length ? (
                <>
                  <Text className="mt-4 font-extrabold text-xs uppercase tracking-[1.2px] text-clay-deep">Hashtags</Text>
                  <Text testID="share-hashtags-preview" className="mt-1 font-sans text-base leading-[23px] text-ink">{prepared.hashtags.join(' ')}</Text>
                </>
              ) : null}
              {adoptionLink ? (
                <>
                  <Text className="mt-4 font-extrabold text-xs uppercase tracking-[1.2px] text-clay-deep">Adoption link</Text>
                  <Text testID="share-link-preview" className="mt-1 font-sans text-base leading-[23px] text-ink">{adoptionLink}</Text>
                </>
              ) : null}
            </Card>

            <View className="mb-3 flex-row flex-wrap gap-2">
              <TinyButton testID="share-copy-caption" label="Copy Caption" onPress={() => void copy(prepared?.caption ?? '', 'Caption')} />
              <TinyButton testID="share-copy-full" label="Copy Full Post" onPress={() => void copy(prepared?.shareText ?? '', 'Full post')} />
              {prepared?.callToAction ? <TinyButton testID="share-copy-cta" label="Copy CTA" onPress={() => void copy(prepared.callToAction, 'CTA')} /> : null}
              {prepared?.hashtags.length ? <TinyButton testID="share-copy-hashtags" label="Copy Hashtags" onPress={() => void copy(prepared.hashtags.join(' '), 'Hashtags')} /> : null}
              {adoptionLink ? <TinyButton testID="share-copy-link" label="Copy Adoption Link" onPress={() => void copy(adoptionLink ?? '', 'Adoption link')} /> : null}
            </View>

            {notice ? <Notice text={notice} /> : null}
            {nativeShareComplete ? (
              <Card testID="share-finished-card" tone="beige" className="mb-3" raised={false}>
                <Text className="font-bold text-base text-forest">Back from sharing?</Text>
                <Text className="mt-1 font-sans text-sm leading-[20px] text-ink-muted">
                  Only save this as posted after you’ve finished the post in {platform}.
                </Text>
                <View className="mt-3 self-start">
                  <TinyButton
                    testID="share-finished-posting"
                    label="I Finished Posting"
                    tone="forest"
                    onPress={() => {
                      setNativeShareComplete(false);
                      setPlatformsPosted([]);
                      setConfirmationOpen(true);
                    }}
                  />
                </View>
              </Card>
            ) : null}
            {error ? <View testID="share-error" className="mb-3 rounded-2xl bg-clay-soft px-4 py-3"><Text className="font-bold text-sm text-clay-deep">{error}</Text></View> : null}

            <View className="mt-auto pb-6">
              <Button
                testID="share-now"
                label={attachedMediaItems.length > 1 ? `Share Cover Photo to ${platform}` : attachedMedia ? `Share Media to ${platform}` : `Share to ${platform}`}
                icon={<Share2 size={18} color={colors.cream} strokeWidth={2.5} />}
                loading={sharing}
                onPress={() => void openNativeShare()}
              />
              <Button
                testID="share-edit-post"
                label="Edit"
                variant="secondary"
                size="md"
                className="mt-3"
                onPress={() => router.push({ pathname: '/create/editor', params: { draftId: post.id } })}
              />
            </View>
          </View>
        )}
        </View>
      </ScrollView>

      <MediaPickerSheet
        visible={mediaPickerOpen}
        fosterName={foster.name}
        items={fosterMedia}
        allowedTypes={post.sourceType === 'video' ? ['video'] : ['photo']}
        selectedMediaId={attachedMedia?.id ?? null}
        multiSelect={post.sourceType !== 'video'}
        selectedMediaIds={attachmentIds}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={attachMedia}
        onSelectMany={attachPhotos}
      />
      <PostingConfirmationModal
        visible={confirmationOpen}
        selectedPlatforms={platformsPosted}
        onToggle={togglePostedPlatform}
        onConfirm={confirmPosted}
        onNotYet={() => {
          setConfirmationOpen(false);
          setNotice('Nothing was marked posted.');
        }}
        onCancel={() => setConfirmationOpen(false)}
      />
      <PlanCompletionModal visible={planConfirmOpen} day={post.planDay} onChoose={finishPlanDecision} />
    </Screen>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <View testID="share-notice" className="mb-3 flex-row items-center rounded-2xl bg-forest-soft px-4 py-3">
      <Check size={16} color={colors.forest} strokeWidth={3} />
      <Text className="ml-2 flex-1 font-bold text-sm text-forest">{text}</Text>
    </View>
  );
}

function PostingConfirmationModal({
  visible,
  selectedPlatforms,
  onToggle,
  onConfirm,
  onNotYet,
  onCancel,
}: {
  visible: boolean;
  selectedPlatforms: readonly SharePlatform[];
  onToggle: (platform: SharePlatform) => void;
  onConfirm: () => void;
  onNotYet: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal testID="did-post-modal" visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 justify-end bg-forest-deep/50 px-4 pb-5">
        <View className="max-h-[82%] rounded-[32px] bg-cream p-5" style={liftedShadow}>
          <View className="mb-4 h-1.5 w-12 self-center rounded-full bg-beige-dark" />
          <Text className="font-display text-2xl text-forest">Did you post it?</Text>
          <Text className="mt-1 font-sans text-base leading-[22px] text-ink-muted">
            Foster Famous cannot confirm what happened in another app. Only save it if you actually posted.
          </Text>
          <Text className="mb-2 mt-5 font-bold text-base text-ink">Where did you post it?</Text>
          <View className="max-h-[280px]">
            {SHARE_PLATFORMS.map((item) => (
              <PlatformButton
                key={item}
                platform={item}
                selected={selectedPlatforms.includes(item)}
                testID={`posted-platform-${item.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                onPress={() => onToggle(item)}
              />
            ))}
          </View>
          <Button testID="confirm-posted" label="Yes, I Posted It" disabled={selectedPlatforms.length === 0} onPress={onConfirm} />
          <Button testID="posted-not-yet" label="Not Yet" variant="secondary" className="mt-3" onPress={onNotYet} />
          <Button testID="posted-cancel" label="Cancel" variant="ghost" size="md" className="mt-2" onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}

function PlanCompletionModal({
  visible,
  day,
  onChoose,
}: {
  visible: boolean;
  day: number | null;
  onChoose: (complete: boolean) => void;
}) {
  if (!day) return null;
  return (
    <Modal testID="plan-posted-modal" visible={visible} transparent animationType="fade" onRequestClose={() => onChoose(false)}>
      <View className="flex-1 items-center justify-center bg-forest-deep/50 px-5">
        <View className="w-full max-w-[430px] rounded-[30px] bg-cream p-5" style={liftedShadow}>
          <Text className="font-display text-2xl text-forest">Mark Day {day} complete?</Text>
          <Text className="mt-2 font-sans text-base leading-[22px] text-ink-muted">
            Your post has been recorded. You can keep the plan task open if there is more to do.
          </Text>
          <Button testID="plan-posted-yes" label="Yes" className="mt-5" onPress={() => onChoose(true)} />
          <Button testID="plan-posted-not-yet" label="Not Yet" variant="secondary" className="mt-3" onPress={() => onChoose(false)} />
        </View>
      </View>
    </Modal>
  );
}
