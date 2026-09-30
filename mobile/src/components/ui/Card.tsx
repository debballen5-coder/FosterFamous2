import React from 'react';
import { View, type ViewProps } from 'react-native';

import { cn } from '@/lib/cn';
import { softShadow } from '@/lib/theme';

import { PressableScale } from './Pressables';

type Tone = 'white' | 'beige' | 'forest' | 'clay' | 'outline';

const toneClass: Record<Tone, string> = {
  white: 'bg-white border border-hairline/60',
  beige: 'bg-beige border border-beige-dark',
  forest: 'bg-forest',
  clay: 'bg-clay-soft border border-clay/25',
  outline: 'bg-cream-deep/60 border border-dashed border-hairline',
};

interface CardProps extends ViewProps {
  tone?: Tone;
  className?: string;
  /** Adds the soft ambient shadow. Off for nested/inline cards. */
  raised?: boolean;
}

export function Card({ tone = 'white', raised = true, className, style, ...rest }: CardProps) {
  return (
    <View
      {...rest}
      style={[raised && tone !== 'outline' ? softShadow : undefined, style]}
      className={cn('rounded-4xl p-5', toneClass[tone], className)}
    />
  );
}

interface PressableCardProps {
  tone?: Tone;
  className?: string;
  onPress?: () => void;
  raised?: boolean;
  children: React.ReactNode;
  testID?: string;
  accessibilityLabel?: string;
}

export function PressableCard({
  tone = 'white',
  raised = true,
  className,
  onPress,
  children,
  testID,
  accessibilityLabel,
}: PressableCardProps) {
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      scaleTo={0.98}
      style={raised && tone !== 'outline' ? softShadow : undefined}
      className={cn('rounded-4xl p-5', toneClass[tone], className)}>
      {children}
    </PressableScale>
  );
}
