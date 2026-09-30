import React from 'react';
import { Text, View } from 'react-native';

import { cn } from '@/lib/cn';
import type { AdoptionStatus, Compatibility } from '@/lib/types';

const statusStyles: Record<AdoptionStatus, { dot: string; bg: string; text: string }> = {
  'Not Yet Available': { dot: 'bg-forest-mid', bg: 'bg-forest-soft', text: 'text-forest' },
  Available: { dot: 'bg-forest-mid', bg: 'bg-forest-soft', text: 'text-forest' },
  'Application Pending': { dot: 'bg-clay', bg: 'bg-clay-soft', text: 'text-clay-deep' },
  'Meet-and-Greet Scheduled': { dot: 'bg-clay', bg: 'bg-clay-soft', text: 'text-clay-deep' },
  'Adoption Pending': { dot: 'bg-clay-deep', bg: 'bg-clay-soft', text: 'text-clay-deep' },
  'Medical Hold': { dot: 'bg-clay-deep', bg: 'bg-clay-soft', text: 'text-clay-deep' },
  'Foster Hold': { dot: 'bg-ink-muted', bg: 'bg-beige', text: 'text-ink-soft' },
  'Returned to Rescue/Shelter': { dot: 'bg-ink-muted', bg: 'bg-beige', text: 'text-ink-soft' },
  Adopted: { dot: 'bg-forest', bg: 'bg-forest', text: 'text-cream' },
};

/** Friendly placement label for cards and the profile's Current Status section. */
export function placementStatusLabel(status: AdoptionStatus): string {
  if (status === 'Not Yet Available') return 'Not yet available';
  if (status === 'Available') return 'Available for Adoption';
  return status;
}

export function StatusBadge({
  status,
  size = 'md',
}: {
  status: AdoptionStatus;
  size?: 'md' | 'sm';
}) {
  const s = statusStyles[status];
  return (
    <View
      className={cn(
        'flex-row items-center self-start rounded-full',
        s.bg,
        size === 'sm' ? 'h-7 px-2.5' : 'h-8 px-3'
      )}>
      <View className={cn('mr-1.5 h-2 w-2 rounded-full', s.dot)} />
      <Text className={cn('font-bold', s.text, size === 'sm' ? 'text-xs' : 'text-sm')}>
        {placementStatusLabel(status)}
      </Text>
    </View>
  );
}

/**
 * Renders a compatibility answer. Unknown / Still evaluating are rendered in a
 * deliberately neutral style and NEVER as a green "yes" — see
 * src/lib/content-rules.ts.
 */
export function CompatibilityBadge({ value }: { value: Compatibility }) {
  const bg: Record<Compatibility, string> = {
    Yes: 'bg-forest-soft',
    No: 'bg-beige-dark',
    Unknown: 'bg-cream-deep border border-hairline',
    'Still evaluating': 'bg-clay-soft',
  };
  const fg: Record<Compatibility, string> = {
    Yes: 'text-forest',
    No: 'text-ink',
    Unknown: 'text-ink-muted',
    'Still evaluating': 'text-clay-deep',
  };
  return (
    <View className={cn('h-8 items-center justify-center rounded-full px-3', bg[value])}>
      <Text className={cn('font-bold text-sm', fg[value])}>{value}</Text>
    </View>
  );
}
