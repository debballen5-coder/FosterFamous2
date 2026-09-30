import { Check, ChevronRight } from 'lucide-react-native';
import React from 'react';
import { Text, View } from 'react-native';

import { cn } from '@/lib/cn';
import { colors } from '@/lib/theme';

import { PressableScale } from './Pressables';

/** Navigation row used by More, Resources, and Settings. */
export function ListRow({
  title,
  subtitle,
  icon,
  onPress,
  isLast = false,
  testID,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onPress?: () => void;
  isLast?: boolean;
  testID?: string;
}) {
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      scaleTo={0.99}
      className={cn(
        'min-h-[62px] flex-row items-center bg-white px-4 py-3',
        !isLast && 'border-b border-hairline/70'
      )}>
      {icon ? (
        <View className="mr-3.5 h-10 w-10 items-center justify-center rounded-2xl bg-forest-soft">
          {icon}
        </View>
      ) : null}
      <View className="flex-1 pr-2">
        <Text className="font-bold text-lg text-ink">{title}</Text>
        {subtitle ? (
          <Text className="mt-0.5 font-sans text-sm text-ink-muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <ChevronRight size={19} color={colors.inkMuted} />
    </PressableScale>
  );
}

/** Groups ListRows into one rounded, clipped card. */
export function ListGroup({ children }: { children: React.ReactNode }) {
  return (
    <View className="overflow-hidden rounded-4xl border border-hairline/60 bg-white">
      {children}
    </View>
  );
}

/** Check-circle row used by Photo Coach and Video Coach. */
export function CheckRow({
  label,
  checked,
  onPress,
  isLast = false,
  testID,
}: {
  label: string;
  checked: boolean;
  onPress?: () => void;
  isLast?: boolean;
  testID?: string;
}) {
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={onPress}
      scaleTo={0.985}
      className={cn(
        'min-h-[56px] flex-row items-center bg-white px-4 py-3',
        !isLast && 'border-b border-hairline/70'
      )}>
      <View
        className={cn(
          'mr-3.5 h-7 w-7 items-center justify-center rounded-full border-2',
          checked ? 'border-forest bg-forest' : 'border-beige-dark bg-cream'
        )}>
        {checked ? <Check size={16} color={colors.cream} strokeWidth={3.2} /> : null}
      </View>
      <Text
        className={cn(
          'flex-1 font-semibold text-lg',
          checked ? 'text-ink-muted line-through' : 'text-ink'
        )}>
        {label}
      </Text>
    </PressableScale>
  );
}
