import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FileText, ImageOff, Share2 } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';

import { MediaThumbnail } from '@/components/MediaThumbnail';
import { Button, TinyButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PressableScale } from '@/components/ui/Pressables';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { contentPostMediaIds } from '@/lib/content-post-media';
import { findFoster, findMediaItem, useAppStore, useDisplayFosters } from '@/lib/state/app-store';
import { colors } from '@/lib/theme';
import type { ContentPost } from '@/lib/types';

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Updated recently';
  return `Updated ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function postLabel(post: ContentPost): string {
  return post.platform === 'General' ? post.contentType : `${post.contentType} · ${post.platform}`;
}

export default function SavedContentScreen() {
  const router = useRouter();
  const { fosterId, status } = useLocalSearchParams<{ fosterId?: string; status?: string }>();
  const fosters = useDisplayFosters();
  const contentPosts = useAppStore((state) => state.contentPosts);
  const mediaItems = useAppStore((state) => state.mediaItems);
  const duplicateContentPost = useAppStore((state) => state.duplicateContentPost);
  const setContentPostStatus = useAppStore((state) => state.setContentPostStatus);
  const deleteContentPost = useAppStore((state) => state.deleteContentPost);
  const [deleteTarget, setDeleteTarget] = useState<ContentPost | null>(null);
  const filterReady = status === 'ready';
  const foster = fosterId ? findFoster(fosters, fosterId) : undefined;

  const posts = useMemo(
    () => contentPosts
      .filter((post) => (!fosterId || post.petId === fosterId) && (!filterReady || post.status === 'Ready to Post'))
      .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt)),
    [contentPosts, filterReady, fosterId]
  );
  const drafts = posts.filter((post) => post.status === 'Draft');
  const ready = posts.filter((post) => post.status === 'Ready to Post');

  const subtitle = foster
    ? `${foster.name}'s saved drafts, ready posts, and history.`
    : filterReady
      ? 'Your reviewed posts that are ready when you are.'
      : 'Find every saved draft and post in one reliable place.';

  return (
    <Screen testID="saved-content-screen" edges={['top']}>
      <ScreenHeader title={filterReady ? 'Ready to Post' : 'Drafts / Saved Content'} subtitle={subtitle} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 44 }} showsVerticalScrollIndicator={false}>
        {!filterReady ? (
          <View className="mb-5 flex-row gap-3">
            <View className="flex-1 rounded-3xl bg-forest-soft p-4">
              <Text className="font-display text-2xl text-forest">{drafts.length}</Text>
              <Text className="mt-0.5 font-bold text-sm text-forest">Draft{drafts.length === 1 ? '' : 's'} to finish</Text>
            </View>
            <View className="flex-1 rounded-3xl bg-clay-soft p-4">
              <Text className="font-display text-2xl text-clay-deep">{ready.length}</Text>
              <Text className="mt-0.5 font-bold text-sm text-clay-deep">Ready to post</Text>
            </View>
          </View>
        ) : null}

        {posts.length === 0 ? (
          <EmptyState
            testID="saved-content-empty"
            icon={<FileText size={25} color={colors.forest} strokeWidth={2.2} />}
            title={filterReady ? 'Nothing is ready to post yet.' : 'No saved drafts yet.'}
            body={foster ? `When you save a post for ${foster.name}, it will appear right here.` : filterReady ? 'Review a saved draft and mark it ready when you are ready to share.' : 'Create a post and your work will appear here.'}
            actionLabel={foster?.adoptionStatus === 'Adopted' ? undefined : 'Create New'}
            onAction={foster?.adoptionStatus === 'Adopted' ? undefined : () => router.push({ pathname: '/create/editor', params: { fosterId: fosterId ?? undefined, kind: 'Social Media Post' } })}
          />
        ) : (
          posts.map((post) => {
            const postFoster = findFoster(fosters, post.petId);
            const media = findMediaItem(mediaItems, post.primaryMediaId);
            const attachmentCount = contentPostMediaIds(post).length;
            return (
              <Card key={post.id} tone="white" className="mb-3" raised={false}>
                <PressableScale
                  testID={`saved-content-${post.id}`}
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/create/editor', params: { draftId: post.id } })}>
                  <View className="flex-row items-start">
                    {media ? (
                      <MediaThumbnail media={media} size={78} testID={`saved-media-${post.id}`} />
                    ) : postFoster.photoUri ? (
                      <Image source={{ uri: postFoster.photoUri }} style={{ width: 78, height: 78, borderRadius: 16, backgroundColor: colors.beige }} contentFit="cover" />
                    ) : (
                      <View className="h-[78px] w-[78px] items-center justify-center rounded-2xl bg-beige">
                        <ImageOff size={20} color={colors.inkMuted} />
                      </View>
                    )}
                    <View className="ml-3 flex-1">
                      <View className="flex-row items-start justify-between">
                        <Text className="flex-1 pr-2 font-bold text-base text-ink" numberOfLines={1}>{postFoster.name}</Text>
                        <View className="flex-row gap-1.5">
                          {attachmentCount > 1 ? (
                            <View className="rounded-full bg-beige px-2.5 py-1">
                              <Text className="font-bold text-xs text-forest">{attachmentCount} photos</Text>
                            </View>
                          ) : null}
                          <View className="rounded-full bg-forest-soft px-2.5 py-1">
                            <Text className="font-bold text-xs text-forest">{post.status}</Text>
                          </View>
                        </View>
                      </View>
                      <Text className="mt-1 font-bold text-sm text-forest" numberOfLines={1}>{postLabel(post)}</Text>
                      <Text className="mt-1 font-sans text-sm leading-[19px] text-ink-muted" numberOfLines={2}>{post.hook || post.caption || 'No caption preview yet.'}</Text>
                      <Text className="mt-1.5 font-bold text-xs text-ink-muted">{formatUpdatedAt(post.updatedAt)}</Text>
                    </View>
                  </View>
                </PressableScale>
                <View className="mt-3 flex-row flex-wrap gap-2">
                  <TinyButton testID={`saved-continue-${post.id}`} label="Continue Editing" onPress={() => router.push({ pathname: '/create/editor', params: { draftId: post.id } })} />
                  {post.status !== 'Archived' && postFoster.adoptionStatus !== 'Adopted' ? (
                    <TinyButton testID={`saved-share-${post.id}`} label={post.status === 'Ready to Post' ? 'Share / Post' : 'Share'} tone="forest" onPress={() => router.push({ pathname: '/share/[postId]', params: { postId: post.id } })} />
                  ) : null}
                  {post.status === 'Archived' ? (
                    <TinyButton testID={`saved-restore-${post.id}`} label="Restore" onPress={() => setContentPostStatus(post.id, 'Draft')} />
                  ) : (
                    <TinyButton testID={`saved-archive-${post.id}`} label="Archive" onPress={() => setContentPostStatus(post.id, 'Archived')} />
                  )}
                  <TinyButton testID={`saved-duplicate-${post.id}`} label="Duplicate" onPress={() => duplicateContentPost(post.id)} />
                  <TinyButton testID={`saved-delete-${post.id}`} label="Delete" tone="clay" onPress={() => setDeleteTarget(post)} />
                </View>
              </Card>
            );
          })
        )}

        {!foster || foster.adoptionStatus !== 'Adopted' ? (
          <Button
            testID="saved-content-create-new"
            label="Create New"
            className="mt-3"
            icon={<Share2 size={16} color={colors.cream} strokeWidth={2.3} />}
            onPress={() => router.push({ pathname: '/create/editor', params: { fosterId: fosterId ?? undefined, kind: 'Social Media Post' } })}
          />
        ) : null}
      </ScrollView>
      <Modal visible={Boolean(deleteTarget)} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <View className="flex-1 justify-end bg-forest-deep/50 px-4 pb-5">
          <View className="rounded-[32px] bg-cream p-5">
            <Text className="font-display text-2xl text-forest">Delete saved content?</Text>
            <Text className="mt-2 font-sans text-base leading-[22px] text-ink-muted">
              This permanently removes this saved draft or post. Its media and other saved content will stay safe.
            </Text>
            <Button
              testID="confirm-delete-saved-content"
              label="Delete"
              className="mt-5"
              onPress={() => {
                if (deleteTarget) deleteContentPost(deleteTarget.id);
                setDeleteTarget(null);
              }}
            />
            <Button testID="cancel-delete-saved-content" label="Cancel" variant="secondary" className="mt-3" onPress={() => setDeleteTarget(null)} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
