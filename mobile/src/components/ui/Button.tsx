import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { cn } from '@/lib/cn';
import { colors, softShadow } from '@/lib/theme';

import { PressableScale } from './Pressables';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'outline';
export type ButtonSize = 'lg' | 'md' | 'sm';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Rendered to the left of the label. */
  icon?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
  testID?: string;
}

const containerByVariant: Record<ButtonVariant, string> = {
  primary: 'bg-forest',
  accent: 'bg-clay',
  secondary: 'bg-beige',
  ghost: 'bg-transparent',
  outline: 'bg-transparent border-2 border-forest/25',
};

const textByVariant: Record<ButtonVariant, string> = {
  primary: 'text-cream',
  accent: 'text-white',
  secondary: 'text-forest',
  ghost: 'text-forest',
  outline: 'text-forest',
};

// Every button keeps a 48pt+ tap target — these are used by tired foster
// parents holding a wriggling animal.
const sizeByKey: Record<ButtonSize, string> = {
  lg: 'h-[58px] px-7 rounded-3xl',
  md: 'h-[50px] px-5 rounded-2xl',
  sm: 'h-[44px] px-4 rounded-2xl',
};

const textSizeByKey: Record<ButtonSize, string> = {
  lg: 'text-lg',
  md: 'text-base',
  sm: 'text-base',
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  disabled = false,
  loading = false,
  fullWidth = true,
  className,
  testID,
}: ButtonProps) {
  const elevated = variant === 'primary' || variant === 'accent';

  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      haptic={variant === 'ghost' ? false : 'light'}
      onPress={onPress}
      style={elevated && !disabled ? softShadow : undefined}
      className={cn(
        'flex-row items-center justify-center',
        containerByVariant[variant],
        sizeByKey[size],
        fullWidth ? 'w-full' : 'self-start',
        disabled && 'opacity-40',
        className
      )}>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'accent' ? colors.cream : colors.forest}
          style={{ marginRight: 8 }}
        />
      ) : icon ? (
        <View className="mr-2">{icon}</View>
      ) : null}
      <Text
        className={cn(
          'font-bold text-center',
          textByVariant[variant],
          textSizeByKey[size],
          variant === 'ghost' && 'underline'
        )}>
        {label}
      </Text>
    </PressableScale>
  );
}

/** Small pill button used inside cards and list rows. */
export function TinyButton({
  label,
  onPress,
  tone = 'neutral',
  testID,
}: {
  label: string;
  onPress?: () => void;
  tone?: 'neutral' | 'forest' | 'clay';
  testID?: string;
}) {
  const toneClass =
    tone === 'forest'
      ? 'bg-forest'
      : tone === 'clay'
        ? 'bg-clay-soft border border-clay/30'
        : 'bg-cream-deep border border-hairline';
  const textClass =
    tone === 'forest' ? 'text-cream' : tone === 'clay' ? 'text-clay-deep' : 'text-ink-soft';

  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      scaleTo={0.94}
      className={cn('h-9 min-w-[72px] items-center justify-center rounded-full px-3.5', toneClass)}>
      <Text className={cn('font-bold text-sm', textClass)}>{label}</Text>
    </PressableScale>
  );
}
