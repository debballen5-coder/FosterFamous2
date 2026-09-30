import { Check, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, useWindowDimensions, View } from 'react-native';

import { MediaThumbnail } from '@/components/MediaThumbnail';
import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/Pressables';
import { cn } from '@/lib/cn';
import { colors } from '@/lib/theme';
import type { MediaItem, MediaType } from '@/lib/types';

type MediaFilter = 'all' | 'favorites' | 'photo' | 'video';

const FILTERS: readonly { key: MediaFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'favorites', label: 'Favorites' },
  { key: 'photo', label: 'Photos' },
  { key: 'video', label: 'Videos' },
];

interface MediaPickerSheetProps {
  visible: boolean;
  fosterName: string;
  items: readonly MediaItem[];
  allowedTypes: readonly MediaType[];
  selectedMediaId: string | null;
  /** Enables photo selection without changing existing one-item picker calls. */
  multiSelect?: boolean;
  selectedMediaIds?: readonly string[];
  onClose: () => void;
  onSelect: (media: MediaItem) => void;
  onSelectMany?: (media: MediaItem[]) => void;
}

export function MediaPickerSheet({
  visible,
  fosterName,
  items,
  allowedTypes,
  selectedMediaId,
  multiSelect = false,
  selectedMediaIds = [],
  onClose,
  onSelect,
  onSelectMany,
}: MediaPickerSheetProps) {
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState<MediaFilter>('all');
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const availableFilters = FILTERS.filter(
    (item) => item.key === 'all' || item.key === 'favorites' || allowedTypes.includes(item.key)
  );
  const thumbnailSize = Math.max(96, Math.floor((Math.min(width, 520) - 84) / 2));

  useEffect(() => {
    if (visible) {
      setFilter('all');
      setPendingIds(
        multiSelect
          ? [...new Set(selectedMediaIds)]
          : selectedMediaId
            ? [selectedMediaId]
            : []
      );
    }
  }, [multiSelect, selectedMediaId, selectedMediaIds, visible]);

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (item.deletedAt || !allowedTypes.includes(item.type)) return false;
        if (filter === 'favorites') return item.favorite;
        if (filter === 'photo' || filter === 'video') return item.type === filter;
        return true;
      }),
    [allowedTypes, filter, items]
  );
  const pendingMedia = pendingIds
    .map((id) => items.find((item) => item.id === id && !item.deletedAt && allowedTypes.includes(item.type)))
    .filter((item): item is MediaItem => Boolean(item));

  const toggleItem = (item: MediaItem) => {
    if (!multiSelect) {
      setPendingIds([item.id]);
      return;
    }
    setPendingIds((current) =>
      current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id]
    );
  };

  const selectionCopy = multiSelect
    ? pendingMedia.length === 1
      ? 'Use 1 Selected Photo'
      : `Use ${pendingMedia.length} Selected Photos`
    : 'Use Selected Media';

  return (
    <Modal
      testID="media-picker-modal"
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-forest-deep/45">
        <Pressable
          testID="media-picker-backdrop"
          accessibilityRole="button"
          accessibilityLabel="Close media picker"
          className="absolute inset-0"
          onPress={onClose}
        />
        <View
          testID="media-picker-sheet"
          className="max-h-[88%] min-h-[62%] rounded-t-[32px] bg-cream px-5 pb-7 pt-3">
          <View className="mb-3 h-1.5 w-11 self-center rounded-full bg-hairline" />
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-4">
              <Text className="font-display text-2xl text-forest">{fosterName}’s Library</Text>
              <Text className="mt-1 font-sans text-sm text-ink-muted">
                {multiSelect ? 'Choose one or more saved photos.' : 'Choose one saved photo or video.'}
              </Text>
            </View>
            <PressableScale
              testID="media-picker-close"
              accessibilityRole="button"
              accessibilityLabel="Close media picker"
              onPress={onClose}
              className="h-11 w-11 items-center justify-center rounded-full bg-white">
              <X size={20} color={colors.inkSoft} />
            </PressableScale>
          </View>

          <View className="my-4 flex-row gap-2">
            {availableFilters.map((item) => {
              const active = filter === item.key;
              return (
                <PressableScale
                  key={item.key}
                  testID={`media-picker-tab-${item.key}`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => setFilter(item.key)}
                  className={cn(
                    'h-10 flex-1 items-center justify-center rounded-full',
                    active ? 'bg-forest' : 'border border-hairline bg-white'
                  )}>
                  <Text className={cn('font-bold text-xs', active ? 'text-cream' : 'text-ink-soft')}>
                    {item.label}
                  </Text>
                </PressableScale>
              );
            })}
          </View>

          <FlatList
            testID="media-picker-results"
            data={filteredItems}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={{ gap: 12 }}
            contentContainerStyle={{ gap: 12, paddingBottom: 16, flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View testID="media-picker-empty" className="flex-1 items-center justify-center rounded-3xl bg-white px-6 py-12">
                <Text className="text-center font-bold text-lg text-forest">Nothing here yet</Text>
                <Text className="mt-1 text-center font-sans text-sm leading-[20px] text-ink-muted">
                  Add new media from the post builder, then it will be saved here for reuse.
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const selected = pendingIds.includes(item.id);
              return (
                <PressableScale
                  testID={`media-picker-item-${item.id}`}
                  accessibilityRole={multiSelect ? 'checkbox' : 'radio'}
                  accessibilityState={{ selected, checked: selected }}
                  accessibilityLabel={item.metadata.title || `${item.type} from ${fosterName}'s library`}
                  onPress={() => toggleItem(item)}
                  className={cn(
                    'flex-1 overflow-hidden rounded-3xl border-2 bg-white p-2',
                    selected ? 'border-clay' : 'border-transparent'
                  )}>
                  <MediaThumbnail
                    media={item}
                    size={thumbnailSize}
                    testID={`media-picker-thumbnail-${item.id}`}
                  />
                  <View className="mt-2 flex-row items-center justify-between px-1 pb-1">
                    <Text className="flex-1 pr-2 font-bold text-sm text-ink" numberOfLines={1}>
                      {item.metadata.title || (item.type === 'photo' ? 'Photo' : 'Video')}
                    </Text>
                    {selected ? (
                      <View className="h-6 w-6 items-center justify-center rounded-full bg-clay">
                        <Check size={14} color={colors.white} strokeWidth={3} />
                      </View>
                    ) : null}
                  </View>
                </PressableScale>
              );
            }}
          />

          <Button
            testID="media-picker-use-selected"
            label={selectionCopy}
            disabled={pendingMedia.length === 0}
            onPress={() => {
              if (!multiSelect && pendingMedia[0]) onSelect(pendingMedia[0]);
              if (multiSelect && pendingMedia.length > 0) {
                if (onSelectMany) onSelectMany(pendingMedia);
                else if (pendingMedia[0]) onSelect(pendingMedia[0]);
              }
            }}
          />
        </View>
      </View>
    </Modal>
  );
}
