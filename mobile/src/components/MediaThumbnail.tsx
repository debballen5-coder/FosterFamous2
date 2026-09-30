import { Image } from 'expo-image';
import { Heart, ImageOff, Play } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { isBrokenMediaUri, mediaUri } from '@/lib/media-storage';
import { colors } from '@/lib/theme';
import type { MediaItem } from '@/lib/types';

export interface MediaThumbnailProps {
  media: MediaItem;
  size?: number;
  testID: string;
}

export function MediaThumbnail({ media, size = 96, testID }: MediaThumbnailProps) {
  const displayUri = mediaUri(media, true);
  const [broken, setBroken] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    setBroken(false);
    void isBrokenMediaUri(displayUri).then((isBroken) => {
      if (active) setBroken(isBroken);
    });
    return () => {
      active = false;
    };
  }, [displayUri]);

  return (
    <View
      testID={testID}
      accessibilityLabel={`${media.type === 'video' ? 'Video' : 'Photo'} thumbnail${media.favorite ? ', favorite' : ''}`}
      style={{ width: size, height: size, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.beige }}>
      {broken ? (
        <View
          testID={`${testID}-broken`}
          className="flex-1 items-center justify-center bg-beige px-2">
          <ImageOff size={22} color={colors.inkMuted} strokeWidth={2} />
          <Text className="mt-1 text-center font-sans text-xs text-ink-muted">Unavailable</Text>
        </View>
      ) : (
        <Image
          testID={`${testID}-image`}
          source={{ uri: displayUri }}
          style={{ width: size, height: size }}
          contentFit="cover"
          transition={160}
          onError={() => setBroken(true)}
        />
      )}

      {!broken && media.type === 'video' ? (
        <View
          testID={`${testID}-video-badge`}
          className="absolute bottom-2 left-2 h-7 w-7 items-center justify-center rounded-full bg-forest/85">
          <Play size={13} color={colors.white} fill={colors.white} strokeWidth={2} />
        </View>
      ) : null}

      {media.favorite ? (
        <View
          testID={`${testID}-favorite-badge`}
          className="absolute right-2 top-2 h-7 w-7 items-center justify-center rounded-full bg-white/90">
          <Heart size={14} color={colors.clay} fill={colors.clay} strokeWidth={2} />
        </View>
      ) : null}
    </View>
  );
}
