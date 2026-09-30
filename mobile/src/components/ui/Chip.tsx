import { Check } from 'lucide-react-native';
import React from 'react';
import { Text, View } from 'react-native';

import { cn } from '@/lib/cn';
import { colors } from '@/lib/theme';

import { PressableScale } from './Pressables';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Shows a check mark when selected. Used for multi-select groups. */
  showCheck?: boolean;
  testID?: string;
}

/** Selectable pill. Tap target is 44pt tall. */
export function Chip({ label, selected = false, onPress, showCheck = false, testID }: ChipProps) {
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      scaleTo={0.94}
      className={cn(
        'h-11 flex-row items-center justify-center rounded-full border px-4',
        selected ? 'border-forest bg-forest' : 'border-hairline bg-white'
      )}>
      {selected && showCheck ? (
        <Check size={15} color={colors.cream} strokeWidth={3} style={{ marginRight: 5 }} />
      ) : null}
      <Text className={cn('font-semibold text-base', selected ? 'text-cream' : 'text-ink-soft')}>
        {label}
      </Text>
    </PressableScale>
  );
}

/** Non-interactive tag, e.g. personality traits on a profile. */
export function Tag({
  label,
  tone = 'beige',
}: {
  label: string;
  tone?: 'beige' | 'forest' | 'clay';
}) {
  const styles =
    tone === 'forest'
      ? 'bg-forest-soft'
      : tone === 'clay'
        ? 'bg-clay-soft border border-clay/20'
        : 'bg-beige';
  const text = tone === 'clay' ? 'text-clay-deep' : 'text-forest';

  return (
    <View className={cn('h-8 items-center justify-center rounded-full px-3', styles)}>
      <Text className={cn('font-bold text-sm', text)}>{label}</Text>
    </View>
  );
}

/** Wraps chips/tags with consistent gaps. */
export function ChipRow({ children }: { children: React.ReactNode }) {
  return <View className="flex-row flex-wrap gap-2">{children}</View>;
}
