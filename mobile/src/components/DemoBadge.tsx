import { Info } from 'lucide-react-native';
import React from 'react';
import { Text, View } from 'react-native';

import { colors } from '@/lib/theme';

/**
 * Marks any content that comes from the built-in sample data. A new foster
 * parent must never confuse Winston or Marigold with their own animal, and
 * demo values are never written to the real foster store.
 */
export function DemoBadge({ size = 'md' }: { size?: 'md' | 'sm' }) {
  return (
    <View
      className={
        size === 'sm'
          ? 'h-6 flex-row items-center rounded-full bg-clay-soft px-2'
          : 'h-7 flex-row items-center rounded-full bg-clay-soft px-2.5'
      }>
      <Info size={size === 'sm' ? 11 : 12} color={colors.clayDeep} strokeWidth={2.6} />
      <Text
        className={
          size === 'sm'
            ? 'ml-1 font-extrabold text-xs uppercase tracking-[0.8px] text-clay-deep'
            : 'ml-1 font-extrabold text-xs uppercase tracking-[1px] text-clay-deep'
        }>
        Sample
      </Text>
    </View>
  );
}

/** Full-width explainer shown above sample content. */
export function DemoNotice({ text }: { text: string }) {
  return (
    <View className="flex-row items-start rounded-3xl border border-clay/25 bg-clay-soft/70 p-4">
      <Info size={17} color={colors.clayDeep} strokeWidth={2.4} style={{ marginTop: 1 }} />
      <Text className="ml-2.5 flex-1 font-medium text-base leading-[20px] text-clay-deep">
        {text}
      </Text>
    </View>
  );
}
