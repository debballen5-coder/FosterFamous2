import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Camera,
  Check,
  Copy,
  ImageOff,
  Library,
  Lightbulb,
  MessageSquareQuote,
  PenLine,
  Plus,
  Save,
  Share2,
  Sparkles,
  Video,
} from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useMutation } from '@tanstack/react-query';

import { DemoBadge } from '@/components/DemoBadge';
import { MediaThumbnail } from '@/components/MediaThumbnail';
import { MediaPickerSheet } from '@/components/media/MediaPickerSheet';
import { Button, TinyButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FieldLabel, TextField } from '@/components/ui/Field';
import { PressableScale } from '@/components/ui/Pressables';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import {
  ContentGenerationService,
  createContentGenerationActionKey,
  type ContentGenerationRequest,
  type ContentTransformation,
} from '@/lib/content-generation';
import { cn } from '@/lib/cn';
import {
  freshCreateWorkspace,
  isCurrentGenerationScope,
  ownedMediaIds,
  type GenerationScope,
} from '@/lib/create-generation-scope';
import { contentPostMediaIds, normalizeContentPostMedia } from '@/lib/content-post-media';
import { isContentPostStale } from '@/lib/foster-current-info';
import { mediaUri, pickMediaFromLibrary } from '@/lib/media-storage';
import { goBackOrReplace } from '@/lib/navigation';
import { CREATE_OPTIONS } from '@/lib/options';
import { captionOnlyText } from '@/lib/share-content';
import {
  findContentPost,
  findFoster,
  findMediaItem,
  getMediaForFoster,
  useAppStore,
  useDisplayFosters,
} from '@/lib/state/app-store';
import { colors, softShadow } from '@/lib/theme';
import type {
  ContentCreationMode,
  ContentLength,
  ContentPlatform,
  ContentPost,
  ContentPostStatus,
  ContentSourceType,
  ContentTone,
  ContentType,
  GeneratedContent,
  MediaItem,
  MediaType,
} from '@/lib/types';

const SOURCES: readonly {
  key: ContentSourceType;
  label: string;
  Icon: typeof Camera;
}[] = [
  { key: 'photo', label: 'A Photo', Icon: Camera },
  { key: 'video', label: 'A Video', Icon: Video },
  { key: 'story', label: 'A Story to Tell', Icon: MessageSquareQuote },
  { key: 'idea', label: 'Nothing Yet — Give Me an Idea', Icon: Lightbulb },
];

const TONES: readonly ContentTone[] = [
  'Warm',
  'Funny',
  'Heartwarming',
  'Playful',
  'Professional',
  'Hopeful',
  'Straightforward',
];
const LENGTHS: readonly ContentLength[] = ['Short', 'Medium', 'Detailed'];
const URGENCY_REASONS = [
  'Adoption event coming up',
  'Foster placement ending',
  'Shelter/rescue deadline',
  'Medical/logistical reason',
  'Long stay / needs renewed attention',
  'No specific deadline',
] as const;

interface GenerationAttempt extends GenerationScope {
  controller: AbortController;
  request: ContentGenerationRequest;
}

interface MediaImportAttempt {
  fosterId: string;
  requestId: string;
  type: MediaType;
}

function isContentType(value: string | undefined): value is ContentType {
  return CREATE_OPTIONS.some((option) => option.title === value);
}

function defaultPlatform(contentType: ContentType): ContentPlatform {
  if (contentType === 'Facebook Post' || contentType === 'Please Share Post') return 'Facebook';
  if (contentType === 'Instagram Caption' || contentType === 'Story Idea') return 'Instagram';
  if (contentType === 'Reel / TikTok Script') return 'Reel / TikTok';
  if (contentType === 'Petfinder / Rescue Listing' || contentType === 'Adoption Bio') {
    return 'Petfinder / Rescue';
  }
  if (contentType === 'Local Community Post') return 'Local Community';
  return 'General';
}

function defaultLength(contentType: ContentType): ContentLength {
  if (contentType === 'Instagram Caption' || contentType === 'Reel / TikTok Script') return 'Short';
  if (contentType === 'Adoption Bio' || contentType === 'Petfinder / Rescue Listing') {
    return 'Detailed';
  }
  return 'Medium';
}

function fullPost(content: GeneratedContent): string {
  return [
    content.hook,
    captionOnlyText(content),
    content.callToAction,
    content.onScreenText ? `On-screen text: ${content.onScreenText}` : '',
    content.hashtags.join(' '),
  ]
    .filter(Boolean)
    .join('\n\n');
}

function mediaDescription(media: MediaItem | undefined): string {
  return media?.metadata.title.trim() || media?.metadata.notes.trim() || '';
}

function manualContent(caption: string): GeneratedContent {
  return {
    hook: '',
    caption: caption.trim(),
    callToAction: '',
    onScreenText: '',
    keywords: [],
    hashtags: [],
    shortVersion: caption.trim(),
    notes: ['Kept exactly as you wrote it.'],
    warnings: [],
    generatedAt: new Date().toISOString(),
  };
}

function UnavailableMedia({ testID }: { testID: string }) {
  return (
    <View
      testID={testID}
      className="h-28 flex-1 items-center justify-center rounded-2xl bg-beige px-3">
      <ImageOff size={24} color={colors.inkMuted} strokeWidth={2} />
      <Text className="mt-1 text-center font-bold text-sm text-ink-muted">This photo or video is no longer available. Choose another item to continue.</Text>
    </View>
  );
}

function ResultField({
  label,
  value,
  onChangeText,
  multiline = true,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  testID: string;
}) {
  return (
    <Card tone="white" className="mb-3" raised={false}>
      <Text className="mb-2 font-extrabold text-xs uppercase tracking-[1.2px] text-clay-deep">
        {label}
      </Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        textAlignVertical="top"
        style={{
          minHeight: multiline ? 72 : 44,
          fontFamily: 'Nunito_500Medium',
          fontSize: label === 'Hook' ? 19 : 16,
          lineHeight: label === 'Hook' ? 26 : 23,
          color: colors.ink,
        }}
      />
    </Card>
  );
}

export default function CreatorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    kind?: string;
    fosterId?: string;
    source?: ContentSourceType;
    context?: string;
    planDay?: string;
    draftId?: string;
    mediaId?: string;
  }>();
  const fosters = useDisplayFosters();
  const contentPosts = useAppStore((state) => state.contentPosts);
  const publicationRecords = useAppStore((state) => state.publicationRecords);
  const mediaItems = useAppStore((state) => state.mediaItems);
  const saveMediaAssets = useAppStore((state) => state.saveMediaAssets);
  const saveContentPost = useAppStore((state) => state.saveContentPost);
  const updateContentPost = useAppStore((state) => state.updateContentPost);
  const routeDraft = findContentPost(contentPosts, params.draftId);
  const [loadedDraftId, setLoadedDraftId] = useState<string | null>(routeDraft?.id ?? null);
  // A route draft belongs only to the foster that owns it. Once the foster changes,
  // it cannot leak status, history, or content into the new draft.
  const loadedDraft = findContentPost(contentPosts, loadedDraftId);
  const initialEditorContext = routeDraft?.editorContext;
  const routeMedia = findMediaItem(mediaItems, params.mediaId);
  const initialMediaIds = contentPostMediaIds(routeDraft);
  const draftMedia = findMediaItem(mediaItems, initialMediaIds[0]);
  const initialMedia = draftMedia ?? routeMedia;
  const requestedType = routeDraft?.contentType ?? params.kind;
  const initialType = isContentType(requestedType)
    ? requestedType
    : routeMedia?.type === 'video'
      ? 'Reel / TikTok Script'
      : 'Social Media Post';
  const [selectedFosterId, setSelectedFosterId] = useState<string>(
    routeDraft?.petId ?? routeMedia?.fosterId ?? params.fosterId ?? fosters[0]?.id ?? ''
  );
  const editorDraft = loadedDraft?.petId === selectedFosterId ? loadedDraft : undefined;
  const [contentType, setContentType] = useState<ContentType>(initialType);
  const [source, setSource] = useState<ContentSourceType | null>(
    routeDraft?.sourceType ?? routeMedia?.type ?? params.source ?? 'idea'
  );
  const [sourceDescription, setSourceDescription] = useState<string>(
    routeDraft?.sourceDescription ?? params.context ?? mediaDescription(initialMedia)
  );
  const [creationMode, setCreationMode] = useState<ContentCreationMode>(
    routeDraft?.creationMode ?? 'ai'
  );
  const [mediaIds, setMediaIds] = useState<string[]>(
    initialMediaIds.length > 0 ? initialMediaIds : routeMedia?.id ? [routeMedia.id] : []
  );
  const primaryMediaId = mediaIds[0] ?? null;
  const [sourceUri, setSourceUri] = useState<string | null>(
    initialMedia ? mediaUri(initialMedia) : routeDraft?.sourceUri ?? null
  );
  const [mediaPickerOpen, setMediaPickerOpen] = useState<boolean>(false);
  const [tone, setTone] = useState<ContentTone>(routeDraft?.tone ?? 'Warm');
  const [length, setLength] = useState<ContentLength>(
    routeDraft?.length ?? defaultLength(initialType)
  );
  const [specialRequest, setSpecialRequest] = useState<string>(initialEditorContext?.specialRequest ?? '');
  const [urgencyReason, setUrgencyReason] = useState<string>(initialEditorContext?.urgencyReason ?? 'No specific deadline');
  const [eventName, setEventName] = useState<string>(initialEditorContext?.eventName ?? '');
  const [eventDate, setEventDate] = useState<string>(initialEditorContext?.eventDate ?? '');
  const [eventTime, setEventTime] = useState<string>(initialEditorContext?.eventTime ?? '');
  const [eventLocation, setEventLocation] = useState<string>(initialEditorContext?.eventLocation ?? '');
  const [eventNotes, setEventNotes] = useState<string>(initialEditorContext?.eventNotes ?? '');
  const [generated, setGenerated] = useState<GeneratedContent | null>(
    routeDraft?.versions.at(-1) ??
      (routeDraft
        ? {
            hook: routeDraft.hook,
            caption: routeDraft.caption,
            callToAction: routeDraft.callToAction,
            onScreenText: routeDraft.onScreenText,
            keywords: routeDraft.keywords,
            hashtags: routeDraft.hashtags,
            shortVersion: routeDraft.shortVersion,
            notes: routeDraft.notes,
            warnings: routeDraft.warnings,
            generatedAt: routeDraft.updatedAt,
          }
        : null)
  );
  const [previousVersion, setPreviousVersion] = useState<GeneratedContent | null>(null);
  const [generatedAgainstCurrentInfoAt, setGeneratedAgainstCurrentInfoAt] = useState<string | undefined>(
    routeDraft?.fosterInfoUpdatedAt
  );
  const [savedId, setSavedId] = useState<string | null>(routeDraft?.id ?? null);
  // A ref updates synchronously so an autosave and a manual save cannot each create a post.
  const savedIdRef = useRef<string | null>(routeDraft?.id ?? null);
  const [notice, setNotice] = useState<string | null>(null);
  const postingHistory = useMemo(
    () => publicationRecords.filter((record) => record.contentPostId === (savedId ?? editorDraft?.id)).sort((a, b) => b.postedAt.localeCompare(a.postedAt)),
    [editorDraft?.id, publicationRecords, savedId]
  );

  const foster = useMemo(
    () => findFoster(fosters, selectedFosterId),
    [fosters, selectedFosterId]
  );
  const marketingPaused = foster.adoptionStatus === 'Adopted';
  const staleDraft = Boolean(editorDraft && isContentPostStale(editorDraft, foster));
  const fosterMedia = useMemo(
    () => getMediaForFoster(mediaItems, foster.id),
    [foster.id, mediaItems]
  );
  const allowedMediaTypes = useMemo<readonly MediaType[]>(
    () =>
      contentType === 'Reel / TikTok Script' && Boolean(params.mediaId)
        ? ['photo', 'video']
        : source === 'video'
          ? ['video']
          : ['photo'],
    [contentType, params.mediaId, source]
  );
  const selectedFosterIdRef = useRef(selectedFosterId);
  const generatedRef = useRef(generated);
  useEffect(() => {
    selectedFosterIdRef.current = selectedFosterId;
  }, [selectedFosterId]);
  useEffect(() => {
    generatedRef.current = generated;
  }, [generated]);

  const selectedMediaCandidate = findMediaItem(mediaItems, primaryMediaId);
  const selectedMedia = selectedMediaCandidate?.fosterId === foster.id ? selectedMediaCandidate : undefined;
  const selectedMediaItems = mediaIds
    .map((id) => findMediaItem(mediaItems, id))
    .filter((media): media is MediaItem => Boolean(media && media.fosterId === foster.id));
  const mediaUnavailable = mediaIds.some((id) => {
    const media = findMediaItem(mediaItems, id);
    return !media || media.fosterId !== foster.id;
  });

  const selectMedia = (media: MediaItem) => {
    if (media.fosterId !== selectedFosterIdRef.current) return;
    setMediaIds([media.id]);
    setSourceUri(mediaUri(media));
    setSource(media.type);
    const description = mediaDescription(media);
    if (description) setSourceDescription(description);
    setMediaPickerOpen(false);
    setNotice(`${media.type === 'photo' ? 'Photo' : 'Video'} selected`);
  };

  const selectPhotos = (media: MediaItem[]) => {
    const photoIds = ownedMediaIds(
      media.filter((item) => item.type === 'photo').map((item) => item.id),
      selectedFosterIdRef.current,
      mediaItems
    );
    if (photoIds.length === 0) return;
    const normalized = normalizeContentPostMedia(photoIds);
    const primary = findMediaItem(mediaItems, normalized.primaryMediaId);
    setMediaIds(normalized.mediaIds);
    setSourceUri(primary ? mediaUri(primary) : null);
    setSource('photo');
    const description = mediaDescription(primary);
    if (description) setSourceDescription(description);
    setMediaPickerOpen(false);
    setNotice(`${normalized.mediaIds.length} ${normalized.mediaIds.length === 1 ? 'photo' : 'photos'} selected`);
  };

  const activeGenerationRef = useRef<GenerationAttempt | null>(null);
  const retryableGenerationRef = useRef<GenerationAttempt | null>(null);
  const [activeGeneration, setActiveGeneration] = useState<GenerationAttempt | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (attempt: GenerationAttempt) =>
      ContentGenerationService.generate(attempt.request, attempt.controller.signal, attempt.idempotencyKey),
    onSuccess: (result, attempt) => {
      if (!isCurrentGenerationScope(activeGenerationRef.current, selectedFosterIdRef.current, attempt)) return;
      const previous = generatedRef.current;
      if (previous) setPreviousVersion(previous);
      setGenerated(result);
      setGeneratedAgainstCurrentInfoAt(
        useAppStore.getState().fosters.find((candidate) => candidate.id === attempt.fosterId)
          ?.currentInfoUpdatedAt
      );
      activeGenerationRef.current = null;
      retryableGenerationRef.current = null;
      setActiveGeneration(null);
      setGenerationError(null);
      setNotice(null);
    },
    onError: (error, attempt) => {
      if (!isCurrentGenerationScope(activeGenerationRef.current, selectedFosterIdRef.current, attempt)) return;
      activeGenerationRef.current = null;
      setActiveGeneration(null);
      setGenerationError(error instanceof Error ? error.message : 'We could not create that content right now.');
    },
  });

  const invalidateGeneration = () => {
    activeGenerationRef.current?.controller.abort();
    activeGenerationRef.current = null;
    retryableGenerationRef.current = null;
    setActiveGeneration(null);
    setGenerationError(null);
    mutation.reset();
  };

  const startGeneration = (transformation?: ContentTransformation, retry = false) => {
    const previousAttempt = retry ? retryableGenerationRef.current : null;
    const selectedId = selectedFosterIdRef.current;
    const freshFoster =
      useAppStore.getState().fosters.find((candidate) => candidate.id === selectedId) ?? foster;
    const request: ContentGenerationRequest = previousAttempt?.request ?? {
      foster: freshFoster,
      contentType,
      platform: defaultPlatform(contentType),
      sourceType: source ?? 'idea',
      sourceDescription,
      // Only a selected, foster-owned photo with an app-managed public copy may
      // be sent for visual grounding. Local device paths never leave the phone.
      sourceMediaUrl: selectedMedia?.type === 'photo' ? selectedMedia.remoteUri ?? undefined : undefined,
      tone,
      length,
      specialRequest: specialRequest.trim() || undefined,
      urgencyReason: contentType === 'Urgent-but-Positive Post' ? urgencyReason : undefined,
      event:
        contentType === 'Adoption Event Post'
          ? {
              name: eventName,
              date: eventDate,
              time: eventTime,
              location: eventLocation,
              notes: eventNotes,
            }
          : undefined,
      existingContent: transformation && generatedRef.current ? generatedRef.current : undefined,
      transformation,
    };
    const idempotencyKey = previousAttempt?.idempotencyKey ?? createContentGenerationActionKey();
    activeGenerationRef.current?.controller.abort();
    const attempt: GenerationAttempt = {
      fosterId: previousAttempt?.fosterId ?? freshFoster.id,
      requestId: previousAttempt?.requestId ?? idempotencyKey,
      idempotencyKey,
      controller: new AbortController(),
      request,
    };
    activeGenerationRef.current = attempt;
    retryableGenerationRef.current = attempt;
    setActiveGeneration(attempt);
    setGenerationError(null);
    mutation.reset();
    mutation.mutate(attempt);
  };

  const canGenerate =
    !marketingPaused &&
    Boolean(source) &&
    (creationMode === 'manual'
      ? Boolean(sourceDescription.trim())
      : contentType !== 'Adoption Event Post' ||
        Boolean(eventName.trim() && eventDate.trim() && eventTime.trim() && eventLocation.trim()));

  const prepareManualDraft = () => {
    const next = manualContent(sourceDescription);
    if (!next.caption) return;
    if (generated) setPreviousVersion(generated);
    setGenerated(next);
    setGeneratedAgainstCurrentInfoAt(undefined);
    setNotice('Your words are ready to review.');
  };

  const changeCreationMode = (mode: ContentCreationMode) => {
    if (mode === creationMode) return;
    invalidateGeneration();
    setCreationMode(mode);
    setGenerated(null);
    setPreviousVersion(null);
    setGeneratedAgainstCurrentInfoAt(undefined);
  };

  const activeMediaImportRef = useRef<MediaImportAttempt | null>(null);
  const [activeMediaImport, setActiveMediaImport] = useState<MediaImportAttempt | null>(null);
  const addMediaMutation = useMutation({
    mutationFn: async (attempt: MediaImportAttempt) => {
      const requestFoster = useAppStore.getState().fosters.find((candidate) => candidate.id === attempt.fosterId) ?? foster;
      if (requestFoster.isDemo) throw new Error('Add your own foster before saving media.');
      const result = await pickMediaFromLibrary(attempt.type, attempt.type === 'photo' ? 10 : 1);
      if (result.permissionDenied) throw new Error('Allow photo-library access to attach media.');
      if (result.canceled || result.assets.length === 0) return { attempt, items: null };
      const stored = await saveMediaAssets({
        fosterId: attempt.fosterId,
        type: attempt.type,
        assets: result.assets,
        source: 'content-builder',
      });
      if (stored.length === 0) {
        throw new Error('We could not save that media to this foster’s library.');
      }
      return { attempt, items: stored };
    },
    onMutate: () => setNotice(null),
    onSuccess: ({ attempt, items }) => {
      if (
        activeMediaImportRef.current?.requestId !== attempt.requestId ||
        selectedFosterIdRef.current !== attempt.fosterId
      ) return;
      activeMediaImportRef.current = null;
      setActiveMediaImport(null);
      if (!items) return;
      const ownedItems = items.filter((item) => item.fosterId === attempt.fosterId);
      if (ownedItems[0]?.type === 'photo') selectPhotos(ownedItems);
      else if (ownedItems[0]) selectMedia(ownedItems[0]);
    },
    onError: (error, attempt) => {
      if (
        activeMediaImportRef.current?.requestId !== attempt.requestId ||
        selectedFosterIdRef.current !== attempt.fosterId
      ) return;
      activeMediaImportRef.current = null;
      setActiveMediaImport(null);
      setNotice(error instanceof Error ? error.message : 'We could not add that media. Please try again.');
    },
  });

  const startMediaImport = (type: MediaType) => {
    const attempt: MediaImportAttempt = {
      fosterId: selectedFosterIdRef.current,
      requestId: createContentGenerationActionKey(),
      type,
    };
    activeMediaImportRef.current = attempt;
    setActiveMediaImport(attempt);
    addMediaMutation.mutate(attempt);
  };

  const updateGenerated = (changes: Partial<GeneratedContent>) => {
    setGenerated((current) => (current ? { ...current, ...changes } : current));
  };

  const saveDraft = (
    status?: ContentPostStatus,
    options: { silent?: boolean; recordVersion?: boolean } = {}
  ): string | null => {
    const attachedMediaIds = ownedMediaIds(mediaIds, foster.id, mediaItems);
    const attachedPrimaryMediaId = attachedMediaIds[0] ?? null;
    const isMeaningful = Boolean(generated || sourceDescription.trim() || attachedPrimaryMediaId);
    if (!isMeaningful) return null;

    const now = new Date().toISOString();
    const id = savedIdRef.current ?? `content-${Date.now()}`;
    // A route draft is only a valid fallback while editing that draft's own foster.
    const persisted = findContentPost(useAppStore.getState().contentPosts, id);
    const baseDraft = persisted ?? editorDraft;
    const current: GeneratedContent = generated ?? {
      hook: '', caption: '', callToAction: '', onScreenText: '', keywords: [], hashtags: [],
      shortVersion: '', notes: [], warnings: [], generatedAt: now,
    };
    const priorVersions = baseDraft?.versions ?? [];
    const serializedCurrent = JSON.stringify(current);
    const hasCurrentVersion = priorVersions.some((version) => JSON.stringify(version) === serializedCurrent);
    const versions = options.recordVersion === false
      ? (priorVersions.length > 0 ? priorVersions : [current])
      : [
          ...priorVersions,
          ...(previousVersion && !priorVersions.some((version) => JSON.stringify(version) === JSON.stringify(previousVersion))
            ? [previousVersion]
            : []),
          ...(hasCurrentVersion ? [] : [current]),
        ];
    const post: ContentPost = {
      id,
      petId: foster.id,
      contentType,
      platform: defaultPlatform(contentType),
      hook: current.hook,
      caption: current.caption,
      callToAction: current.callToAction,
      onScreenText: current.onScreenText,
      keywords: current.keywords,
      hashtags: current.hashtags,
      shortVersion: current.shortVersion,
      notes: current.notes,
      warnings: current.warnings,
      sourceType: source ?? 'idea',
      creationMode,
      sourceDescription,
      primaryMediaId: attachedPrimaryMediaId,
      mediaIds: attachedMediaIds,
      sourceUri: attachedPrimaryMediaId && selectedMedia ? mediaUri(selectedMedia) : null,
      tone,
      length,
      status: status ?? baseDraft?.status ?? 'Draft',
      createdAt: baseDraft?.createdAt ?? now,
      updatedAt: now,
      fosterInfoUpdatedAt: generatedAgainstCurrentInfoAt ?? baseDraft?.fosterInfoUpdatedAt,
      editorContext: { specialRequest, urgencyReason, eventName, eventDate, eventTime, eventLocation, eventNotes },
      planDay: baseDraft?.planDay ?? (params.planDay ? Number(params.planDay) : null),
      versions,
    };
    if (persisted || savedIdRef.current) updateContentPost(id, post);
    else saveContentPost(post);
    savedIdRef.current = id;
    setSavedId(id);
    if (!options.silent) setNotice(status === 'Ready to Post' ? 'Ready to share' : 'Draft saved');
    return id;
  };

  const saveDraftRef = useRef(saveDraft);
  saveDraftRef.current = saveDraft;
  const autosaveFingerprint = useMemo(
    () => JSON.stringify({
      generated, selectedFosterId, contentType, source, creationMode, sourceDescription, mediaIds, sourceUri,
      tone, length, specialRequest, urgencyReason, eventName, eventDate, eventTime, eventLocation, eventNotes,
    }),
    [
      contentType, creationMode, eventDate, eventLocation, eventName, eventNotes, eventTime, generated, length,
      mediaIds, selectedFosterId, source, sourceDescription, sourceUri, specialRequest, tone,
      urgencyReason,
    ]
  );
  const lastAutosavedFingerprint = useRef<string | null>(null);

  useEffect(() => {
    const draftState = JSON.parse(autosaveFingerprint) as {
      generated: GeneratedContent | null;
      sourceDescription: string;
      mediaIds: string[];
    };
    const meaningful = Boolean(draftState.generated || draftState.sourceDescription.trim() || draftState.mediaIds.length);
    if (!meaningful || lastAutosavedFingerprint.current === autosaveFingerprint) return;
    const timer = setTimeout(() => {
      if (saveDraftRef.current(undefined, { silent: true, recordVersion: false })) {
        lastAutosavedFingerprint.current = autosaveFingerprint;
      }
    }, 650);
    return () => clearTimeout(timer);
  }, [autosaveFingerprint, savedId]);

  useEffect(() => {
    return () => {
      // Native interactive-back gestures bypass the custom header; flush the latest draft.
      saveDraftRef.current(undefined, { silent: true, recordVersion: false });
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') return;
      if (saveDraftRef.current(undefined, { silent: true, recordVersion: false })) {
        lastAutosavedFingerprint.current = autosaveFingerprint;
      }
    });
    return () => subscription.remove();
  }, [autosaveFingerprint, savedId]);

  const sharePost = () => {
    const persisted = findContentPost(useAppStore.getState().contentPosts, savedId ?? editorDraft?.id);
    const nextStatus: ContentPostStatus = persisted?.status === 'Posted' ? 'Posted' : 'Ready to Post';
    const postId = saveDraft(nextStatus);
    if (postId) router.push({ pathname: '/share/[postId]', params: { postId } });
  };

  const copyText = async (value: string, label: string) => {
    await Clipboard.setStringAsync(value);
    setNotice(`${label} copied`);
  };

  const rewrite = (transformation: ContentTransformation) => startGeneration(transformation);
  const errorMessage = generationError;

  return (
    <Screen testID="creator-screen" edges={['top']}>
      <ScreenHeader
        title="Smart Post Builder"
        subtitle={contentType}
        onBack={() => {
          saveDraft(undefined, { silent: true, recordVersion: false });
          goBackOrReplace(router, '/(tabs)/create');
        }}
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 52 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(350)}>
          <FieldLabel>Create for</FieldLabel>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ gap: 10, paddingBottom: 4, paddingRight: 4 }}>
            {fosters.filter((item) => item.adoptionStatus !== 'Adopted' || item.id === editorDraft?.petId).map((item) => {
              const active = item.id === selectedFosterId;
              return (
                <PressableScale
                  key={item.id}
                  testID={`creator-foster-${item.id}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    if (item.id !== selectedFosterId) {
                      // Persist the old foster's work, then create an entirely fresh workspace.
                      // Pending work is invalidated before the new foster can render.
                      saveDraft(undefined, { silent: true, recordVersion: false });
                      invalidateGeneration();
                      activeMediaImportRef.current = null;
                      setActiveMediaImport(null);
                      const next = freshCreateWorkspace();
                      setMediaIds(next.mediaIds);
                      setSourceUri(next.sourceUri);
                      setSource(next.source);
                      setCreationMode(next.creationMode);
                      setSourceDescription(next.sourceDescription);
                      setSpecialRequest('');
                      setUrgencyReason('No specific deadline');
                      setEventName('');
                      setEventDate('');
                      setEventTime('');
                      setEventLocation('');
                      setEventNotes('');
                      setGenerated(next.generated);
                      setPreviousVersion(next.previousVersion);
                      setGeneratedAgainstCurrentInfoAt(next.generatedAgainstCurrentInfoAt);
                      setLoadedDraftId(null);
                      savedIdRef.current = null;
                      setSavedId(null);
                      lastAutosavedFingerprint.current = null;
                      setNotice(`Started a new draft for ${item.name}.`);
                    }
                    setSelectedFosterId(item.id);
                  }}
                  style={active ? softShadow : undefined}
                  className={cn(
                    'w-[176px] rounded-3xl border p-3',
                    active ? 'border-forest bg-forest' : 'border-hairline bg-white'
                  )}>
                  <View className="flex-row items-center">
                    <Image
                      source={{ uri: item.photoUri ?? undefined }}
                      style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: colors.beige }}
                      contentFit="cover"
                    />
                    <View className="ml-2.5 flex-1">
                      <Text className={cn('font-bold text-lg', active ? 'text-cream' : 'text-ink')} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text className={cn('font-sans text-xs', active ? 'text-cream/70' : 'text-ink-muted')} numberOfLines={1}>
                        {item.adoptionStatus}
                      </Text>
                    </View>
                  </View>
                  {item.isDemo ? <View className="mt-2"><DemoBadge size="sm" /></View> : null}
                </PressableScale>
              );
            })}
          </ScrollView>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(45).duration(350)} className="mt-6">
          <FieldLabel>What are you creating?</FieldLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
            {CREATE_OPTIONS.map((option) => {
              const active = option.title === contentType;
              return (
                <PressableScale
                  key={option.title}
                  testID={`creator-kind-${option.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                  onPress={() => {
                    const next = option.title as ContentType;
                    setContentType(next);
                    setLength(defaultLength(next));
                  }}
                  className={cn('h-10 justify-center rounded-full px-4', active ? 'bg-forest' : 'border border-hairline bg-white')}>
                  <Text className={cn('font-bold text-sm', active ? 'text-cream' : 'text-ink-soft')}>{option.title}</Text>
                </PressableScale>
              );
            })}
          </ScrollView>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(70).duration(350)} className="mt-6">
          <FieldLabel>How would you like to write it?</FieldLabel>
          <View testID="creator-writing-mode" className="flex-row gap-3">
            <PressableScale
              testID="creator-writing-mode-ai"
              accessibilityRole="radio"
              accessibilityState={{ selected: creationMode === 'ai' }}
              onPress={() => changeCreationMode('ai')}
              className={cn(
                'min-h-[116px] flex-1 rounded-3xl border p-4',
                creationMode === 'ai' ? 'border-forest bg-forest' : 'border-hairline bg-white'
              )}>
              <Sparkles size={21} color={creationMode === 'ai' ? colors.cream : colors.forest} strokeWidth={2.3} />
              <Text className={cn('mt-3 font-bold text-base', creationMode === 'ai' ? 'text-cream' : 'text-ink')}>
                Write it for me
              </Text>
              <Text className={cn('mt-1 font-sans text-xs leading-[17px]', creationMode === 'ai' ? 'text-cream/75' : 'text-ink-muted')}>
                Turn your notes into a fresh, editable post.
              </Text>
            </PressableScale>
            <PressableScale
              testID="creator-writing-mode-manual"
              accessibilityRole="radio"
              accessibilityState={{ selected: creationMode === 'manual' }}
              onPress={() => changeCreationMode('manual')}
              className={cn(
                'min-h-[116px] flex-1 rounded-3xl border p-4',
                creationMode === 'manual' ? 'border-clay bg-clay-soft' : 'border-hairline bg-white'
              )}>
              <PenLine size={21} color={creationMode === 'manual' ? colors.clayDeep : colors.forest} strokeWidth={2.3} />
              <Text className={cn('mt-3 font-bold text-base', creationMode === 'manual' ? 'text-clay-deep' : 'text-ink')}>
                Use my exact words
              </Text>
              <Text className="mt-1 font-sans text-xs leading-[17px] text-ink-muted">
                Keep your caption intact and ready to share.
              </Text>
            </PressableScale>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(90).duration(350)} className="mt-6">
          <FieldLabel>{creationMode === 'ai' ? 'What do you have?' : 'What will this post feature?'}</FieldLabel>
          <View className="flex-row flex-wrap justify-between">
            {SOURCES.map(({ key, label, Icon }) => {
              const active = source === key;
              return (
                <PressableScale
                  key={key}
                  testID={`creator-source-${key}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    setSource(key);
                    if (
                      key !== source &&
                      (key === 'story' || key === 'idea' || selectedMedia?.type !== key)
                    ) {
                      setMediaIds([]);
                      setSourceUri(null);
                    }
                  }}
                  className={cn(
                    'mb-3 h-[100px] w-[48%] justify-between rounded-3xl border p-3.5',
                    active ? 'border-clay bg-clay-soft' : 'border-hairline bg-white'
                  )}>
                  <View className="flex-row justify-between">
                    <Icon size={20} color={active ? colors.clayDeep : colors.forest} strokeWidth={2.2} />
                    {active ? <Check size={18} color={colors.clayDeep} strokeWidth={3} /> : null}
                  </View>
                  <Text className={cn('font-bold text-base leading-[19px]', active ? 'text-clay-deep' : 'text-ink')}>{label}</Text>
                </PressableScale>
              );
            })}
          </View>
        </Animated.View>

        {source === 'photo' || source === 'video' ? (
          <Animated.View entering={FadeInDown.duration(280)}>
            <Card tone="beige" className="mb-4" raised={false}>
              <Text className="font-bold text-lg text-forest">
                {source === 'photo' ? 'Choose a clear, honest moment' : 'Short, steady clips work best'}
              </Text>
              <Text className="mt-1 font-sans text-sm leading-[20px] text-ink-soft">
                {source === 'photo'
                  ? `Pick up to 10 well-lit photos where ${foster.name} is easy to see.`
                  : `Choose a clip that shows ${foster.name}’s personality or progress.`}
              </Text>
            </Card>

            <View className="mb-4 flex-row gap-2">
              <View className="flex-1">
                <Button
                  testID="creator-choose-library"
                  label={`Choose from ${foster.name}’s Library`}
                  variant="secondary"
                  size="md"
                  icon={<Library size={17} color={colors.forest} />}
                  onPress={() => setMediaPickerOpen(true)}
                />
              </View>
              <View className="flex-1">
                <Button
                  testID={`creator-add-new-${source}`}
                  label={source === 'photo' ? 'Add New Photos' : 'Add New Video'}
                  variant="outline"
                  size="md"
                  loading={activeMediaImport?.fosterId === foster.id}
                  icon={<Plus size={17} color={colors.forest} />}
                  onPress={() => startMediaImport(source)}
                />
              </View>
            </View>

            {selectedMedia || mediaUnavailable || sourceUri ? (
              <PressableScale
                testID="creator-change-media"
                onPress={() => setMediaPickerOpen(true)}
                className="mb-4 rounded-3xl border border-hairline bg-white p-3">
                {selectedMediaItems.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ flexGrow: 0 }}
                    contentContainerStyle={{ gap: 8 }}>
                    {selectedMediaItems.map((media, index) => (
                      <View key={media.id} className="relative">
                        <MediaThumbnail
                          media={media}
                          size={112}
                          testID={index === 0 ? 'creator-selected-media' : `creator-selected-media-${index + 1}`}
                        />
                        {index === 0 && selectedMediaItems.length > 1 ? (
                          <View className="absolute bottom-1 left-1 rounded-full bg-forest px-2 py-1">
                            <Text className="font-bold text-[10px] text-cream">Cover</Text>
                          </View>
                        ) : null}
                      </View>
                    ))}
                  </ScrollView>
                ) : mediaUnavailable ? (
                  <UnavailableMedia testID="creator-media-unavailable" />
                ) : source === 'photo' && sourceUri ? (
                  <Image
                    testID="creator-legacy-media"
                    source={{ uri: sourceUri }}
                    style={{ width: 112, height: 112, borderRadius: 16, backgroundColor: colors.beige }}
                    contentFit="cover"
                  />
                ) : (
                  <UnavailableMedia testID="creator-media-unavailable" />
                )}
                <View className={selectedMediaItems.length > 0 ? 'mt-3' : 'ml-3 flex-1'}>
                  <Text className="font-bold text-base text-forest">
                    {source === 'photo' && selectedMediaItems.length > 1
                      ? `${selectedMediaItems.length} photos selected`
                      : 'Selected media'}
                  </Text>
                  <Text className="mt-1 font-sans text-sm text-ink-muted">
                    {source === 'photo' && selectedMediaItems.length > 1
                      ? 'Tap to add, remove, or change photos. The first photo is the cover.'
                      : 'Tap to choose a different item.'}
                  </Text>
                </View>
              </PressableScale>
            ) : null}
            <TextField
              testID="creator-source-description"
              label={
                creationMode === 'manual'
                  ? 'Your post text'
                  : source === 'photo'
                    ? 'What is happening in these photos?'
                    : 'What happens in this video?'
              }
              placeholder={
                creationMode === 'manual'
                  ? `Write the caption you want to share about ${foster.name}.`
                  : source === 'photo'
                    ? `${foster.name} is relaxing on the couch.`
                    : `${foster.name} is playing with a favorite toy.`
              }
              value={sourceDescription}
              onChangeText={setSourceDescription}
              multiline
            />
          </Animated.View>
        ) : source === 'story' ? (
          <TextField
            testID="creator-story-description"
            label={creationMode === 'manual' ? 'Your post text' : 'What happened?'}
            placeholder={
              creationMode === 'manual'
                ? `Write the caption you want to share about ${foster.name}.`
                : `${foster.name} learned something new today…`
            }
            value={sourceDescription}
            onChangeText={setSourceDescription}
            multiline
          />
        ) : source === 'idea' && creationMode === 'manual' ? (
          <TextField
            testID="creator-manual-description"
            label="Your post text"
            placeholder={`Write the caption you want to share about ${foster.name}.`}
            value={sourceDescription}
            onChangeText={setSourceDescription}
            multiline
          />
        ) : source === 'idea' ? (
          <Card tone="beige" className="mb-5" raised={false}>
            <Text className="font-bold text-lg text-forest">We’ll suggest something honest and easy</Text>
            <Text className="mt-1 font-sans text-base leading-[21px] text-ink-soft">
              The idea will use only details already saved in {foster.name}’s profile.
            </Text>
          </Card>
        ) : null}

        {creationMode === 'ai' && contentType === 'Adoption Event Post' ? (
          <Animated.View entering={FadeInDown.duration(280)}>
            <TextField testID="event-name" label="Event name" value={eventName} onChangeText={setEventName} placeholder="Adoption Day" />
            <TextField testID="event-date" label="Event date" value={eventDate} onChangeText={setEventDate} placeholder="Saturday, September 12" />
            <TextField testID="event-time" label="Event time" value={eventTime} onChangeText={setEventTime} placeholder="11 AM–2 PM" />
            <TextField testID="event-location" label="Public event location" value={eventLocation} onChangeText={setEventLocation} placeholder="Rescue name or public venue" />
            <TextField testID="event-notes" label="Optional notes" value={eventNotes} onChangeText={setEventNotes} placeholder="Parking, what to bring, or other confirmed details" multiline />
          </Animated.View>
        ) : null}

        {creationMode === 'ai' && contentType === 'Urgent-but-Positive Post' ? (
          <View className="mb-5">
            <FieldLabel>Is there a real deadline or urgent reason?</FieldLabel>
            <View className="flex-row flex-wrap gap-2">
              {URGENCY_REASONS.map((reason) => (
                <TinyButton
                  key={reason}
                  testID={`urgency-${reason.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                  label={reason}
                  tone={urgencyReason === reason ? 'forest' : 'neutral'}
                  onPress={() => setUrgencyReason(reason)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {creationMode === 'ai' ? (
          <>
            <View className="mb-5">
              <FieldLabel>Tone</FieldLabel>
              <View className="flex-row flex-wrap gap-2">
                {TONES.map((item) => (
                  <TinyButton key={item} testID={`tone-${item.toLowerCase()}`} label={item} tone={tone === item ? 'forest' : 'neutral'} onPress={() => setTone(item)} />
                ))}
              </View>
            </View>

            <View className="mb-5">
              <FieldLabel>Length</FieldLabel>
              <View className="flex-row gap-2">
                {LENGTHS.map((item) => (
                  <View key={item} className="flex-1">
                    <TinyButton testID={`length-${item.toLowerCase()}`} label={item} tone={length === item ? 'clay' : 'neutral'} onPress={() => setLength(item)} />
                  </View>
                ))}
              </View>
            </View>

            <TextField
              testID="creator-special-request"
              label="Special request (optional)"
              placeholder="Anything else the draft should focus on?"
              value={specialRequest}
              onChangeText={setSpecialRequest}
              multiline
            />
          </>
        ) : null}

        {!canGenerate && creationMode === 'ai' && contentType === 'Adoption Event Post' ? (
          <Text className="mb-3 font-sans text-sm text-clay-deep">Add the event name, date, time, and public location before generating.</Text>
        ) : null}
        {!source ? <Text className="mb-3 font-sans text-sm text-clay-deep">Choose what you have to get started.</Text> : null}

        <Button
          testID="creator-generate"
          label={
            creationMode === 'manual'
              ? generated ? 'Use My Updated Text' : 'Use My Text'
              : activeGeneration?.fosterId === foster.id
                ? `Writing for ${foster.name}… 🐾`
                : generated
                  ? 'Write Another Draft'
                  : 'Write My Post'
          }
          icon={
            creationMode === 'manual'
              ? <PenLine size={18} color={colors.cream} strokeWidth={2.4} />
              : <Sparkles size={18} color={colors.cream} strokeWidth={2.4} />
          }
          loading={creationMode === 'ai' && activeGeneration?.fosterId === foster.id}
          disabled={!canGenerate}
          onPress={() => {
            if (creationMode === 'manual') prepareManualDraft();
            else startGeneration();
          }}
        />

        {errorMessage ? (
          <Card tone="clay" className="mt-4" raised={false}>
            <Text testID="creator-error" className="font-bold text-lg text-clay-deep">Foster Famous couldn’t create that draft right now.</Text>
            <Text className="mt-1 font-sans text-base leading-[21px] text-clay-deep/80">{errorMessage} Your foster information is safe.</Text>
            <Button testID="creator-retry" label="Try Again" variant="secondary" size="md" className="mt-3" onPress={() => startGeneration(undefined, true)} />
          </Card>
        ) : null}

        {creationMode === 'ai' && staleDraft ? (
          <Card testID="creator-stale-draft-warning" tone="clay" className="mt-4" raised={false}>
            <Text className="font-bold text-lg text-clay-deep">This draft may use older foster information</Text>
            <Text className="mt-1 font-sans text-sm leading-[20px] text-clay-deep">
              {foster.name}’s saved status or profile changed after this draft was made. Your saved draft will not be changed unless you choose to save a refreshed version.
            </Text>
            <Button
              testID="creator-refresh-current-info"
              label="Refresh With Current Info"
              variant="secondary"
              size="md"
              className="mt-3"
              loading={activeGeneration?.fosterId === foster.id}
              onPress={() => startGeneration()}
            />
          </Card>
        ) : null}

        {generated ? (
          <Animated.View entering={FadeInDown.duration(380)} className="mt-7">
            <View className="mb-3 flex-row items-center justify-between">
              <View>
                <Text className="font-display text-2xl text-forest">
                  {creationMode === 'manual' ? 'Your text draft' : 'Post draft'}
                </Text>
                <Text className="font-sans text-sm text-ink-muted">
                  {creationMode === 'manual' ? 'Kept exactly as you wrote it' : 'Review and make it your own'}
                </Text>
              </View>
              <View className="rounded-full bg-forest-soft px-3 py-1.5"><Text className="font-bold text-xs text-forest">Editable</Text></View>
            </View>

            {previousVersion ? (
              <Card tone="beige" className="mb-3" raised={false}>
                <Text className="font-bold text-base text-forest">Previous version preserved</Text>
                <Text className="mt-1 font-sans text-sm text-ink-muted" numberOfLines={3}>{previousVersion.hook} — {previousVersion.caption}</Text>
                <TinyButton testID="restore-previous-version" label="Use Previous" onPress={() => { const current = generated; setGenerated(previousVersion); setPreviousVersion(current); setGeneratedAgainstCurrentInfoAt(''); }} />
              </Card>
            ) : null}

            {generated.idea ? <ResultField testID="result-idea" label="Today’s Idea" value={generated.idea} onChangeText={(idea) => updateGenerated({ idea })} /> : null}
            {generated.whatToCapture ? <ResultField testID="result-capture" label="What to Capture" value={generated.whatToCapture} onChangeText={(whatToCapture) => updateGenerated({ whatToCapture })} /> : null}
            {generated.suggestedFormat ? <ResultField testID="result-format" label="Suggested Format" value={generated.suggestedFormat} onChangeText={(suggestedFormat) => updateGenerated({ suggestedFormat })} multiline={false} /> : null}
            <ResultField testID="result-hook" label="Hook" value={generated.hook} onChangeText={(hook) => updateGenerated({ hook })} />
            {generated.shotList?.length ? <ResultField testID="result-shot-list" label="Shot List" value={generated.shotList.join('\n')} onChangeText={(value) => updateGenerated({ shotList: value.split('\n').filter(Boolean) })} /> : null}
            <ResultField testID="result-caption" label="Caption" value={generated.caption} onChangeText={(caption) => updateGenerated({ caption })} />
            <ResultField testID="result-cta" label="Call to Action" value={generated.callToAction} onChangeText={(callToAction) => updateGenerated({ callToAction })} />
            {generated.onScreenText ? <ResultField testID="result-screen-text" label="On-Screen Text" value={generated.onScreenText} onChangeText={(onScreenText) => updateGenerated({ onScreenText })} /> : null}
            <ResultField testID="result-keywords" label="Suggested Keywords" value={generated.keywords.join(', ')} onChangeText={(value) => updateGenerated({ keywords: value.split(',').map((item) => item.trim()).filter(Boolean) })} />
            <ResultField testID="result-hashtags" label="Hashtags" value={generated.hashtags.join(' ')} onChangeText={(value) => updateGenerated({ hashtags: value.split(/\s+/).filter(Boolean) })} />
            {generated.whyThisHelps ? <ResultField testID="result-why" label="Why This Helps" value={generated.whyThisHelps} onChangeText={(whyThisHelps) => updateGenerated({ whyThisHelps })} /> : null}

            {generated.warnings.length > 0 ? (
              <Card tone="clay" className="mb-3" raised={false}>
                <Text className="font-bold text-base text-clay-deep">Accuracy notes</Text>
                {generated.warnings.map((warning) => <Text key={warning} className="mt-1 font-sans text-sm leading-[19px] text-clay-deep">• {warning}</Text>)}
              </Card>
            ) : null}

            <Card tone="beige" className="mb-4" raised={false}>
              <Text className="font-bold text-base text-forest">Review before posting</Text>
              <Text className="mt-1 font-sans text-sm leading-[19px] text-ink-soft">Make sure every detail accurately reflects {foster.name}. The final decision always belongs to you.</Text>
            </Card>

            {creationMode === 'ai' ? (
              <>
                <FieldLabel>Try a different direction</FieldLabel>
                <View className="mb-5 flex-row flex-wrap gap-2">
                  <TinyButton testID="creator-another" label="Another Version" onPress={() => rewrite('another')} />
                  <TinyButton testID="creator-shorter" label="Shorter" onPress={() => rewrite('shorter')} />
                  <TinyButton testID="creator-longer" label="Longer" onPress={() => rewrite('longer')} />
                  <TinyButton testID="creator-funnier" label="Funnier" onPress={() => rewrite('funnier')} />
                  <TinyButton testID="creator-heartwarming" label="More Heartwarming" tone="clay" onPress={() => rewrite('heartwarming')} />
                  <TinyButton testID="creator-professional" label="Professional" onPress={() => rewrite('professional')} />
                  <TinyButton testID="creator-playful" label="Playful" onPress={() => rewrite('playful')} />
                </View>
              </>
            ) : null}

            {marketingPaused ? (
              <Card testID="creator-marketing-paused" tone="beige" className="mb-3" raised={false}>
                <Text className="font-bold text-base text-forest">Marketing is paused for this adopted foster.</Text>
                <Text className="mt-1 font-sans text-sm leading-[19px] text-ink-soft">This saved content remains editable and safe. Reactivate the foster before sharing or posting again.</Text>
              </Card>
            ) : (
              <Button testID="creator-share-post" label={postingHistory.length > 0 ? 'Share Again' : 'Share / Post'} icon={<Share2 size={18} color={colors.cream} />} onPress={sharePost} />
            )}
            <Button testID="creator-save" label={savedId ? 'Update Saved Draft' : 'Save Draft'} variant="secondary" className={marketingPaused ? undefined : 'mt-3'} icon={<Save size={17} color={colors.forest} />} onPress={() => saveDraft()} />
            {postingHistory.length > 0 ? (
              <Card tone="beige" className="mt-4" raised={false}>
                <Text className="font-bold text-lg text-forest">Posting history</Text>
                {postingHistory.map((record) => {
                  const date = new Date(record.postedAt);
                  const label = Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                  return <Text key={record.id} className="mt-1.5 font-sans text-sm text-ink-soft">{record.platform} · {label}</Text>;
                })}
              </Card>
            ) : null}
            <View className="mt-3 flex-row gap-2">
              <View className="flex-1"><Button testID="creator-copy-caption" label="Copy Caption" variant="secondary" size="md" icon={<Copy size={16} color={colors.forest} />} onPress={() => void copyText(captionOnlyText(generated), 'Caption')} /></View>
              <View className="flex-1"><Button testID="creator-copy-full" label="Copy Full Post" variant="secondary" size="md" onPress={() => void copyText(fullPost(generated), 'Full post')} /></View>
            </View>
            <View className="mt-3 flex-row gap-2">
              <View className="flex-1"><Button testID="creator-copy-hashtags" label="Copy Hashtags" variant="outline" size="md" onPress={() => void copyText(generated.hashtags.join(' '), 'Hashtags')} /></View>
              <View className="flex-1"><Button testID="creator-copy-cta" label="Copy CTA" variant="outline" size="md" onPress={() => void copyText(generated.callToAction, 'CTA')} /></View>
            </View>
          </Animated.View>
        ) : null}

        {notice ? (
          <View testID="creator-notice" className="mt-4 flex-row items-center justify-center rounded-full bg-forest-soft px-4 py-2">
            <Check size={15} color={colors.forest} strokeWidth={3} />
            <Text className="ml-2 font-bold text-sm text-forest">{notice}</Text>
          </View>
        ) : null}
      </ScrollView>

      <MediaPickerSheet
        visible={mediaPickerOpen}
        fosterName={foster.name}
        items={fosterMedia}
        allowedTypes={allowedMediaTypes}
        selectedMediaId={primaryMediaId}
        multiSelect={source === 'photo'}
        selectedMediaIds={mediaIds}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={selectMedia}
        onSelectMany={selectPhotos}
      />
    </Screen>
  );
}
