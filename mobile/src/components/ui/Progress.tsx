import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { cn } from '@/lib/cn';

interface ProgressBarProps {
  /** 0–100 */
  value: number;
  /** Track thickness. */
  height?: number;
  tone?: 'forest' | 'clay' | 'cream';
  delay?: number;
  className?: string;
}

/** Animated fill bar. The fill grows on mount — small delight, no noise. */
export function ProgressBar({
  value,
  height = 8,
  tone = 'forest',
  delay = 0,
  className,
}: ProgressBarProps) {
  const width = useSharedValue(0);
  const clamped = Math.max(0, Math.min(100, value));

  useEffect(() => {
    width.value = withDelay(delay, withTiming(clamped, { duration: 750 }));
  }, [clamped, delay, width]);

  const style = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  const trackTone = tone === 'cream' ? 'bg-cream/25' : 'bg-beige';
  const fillTone = tone === 'clay' ? 'bg-clay' : tone === 'cream' ? 'bg-cream' : 'bg-forest-mid';

  return (
    <View
      className={cn('w-full overflow-hidden rounded-full', trackTone, className)}
      style={{ height }}>
      <Animated.View style={[style, { height }]} className={cn('rounded-full', fillTone)} />
    </View>
  );
}

/** Label + percentage + bar, as used in the Foster Famous Score breakdown. */
export function ProgressRow({
  label,
  value,
  delay = 0,
  tone = 'forest',
}: {
  label: string;
  value: number;
  delay?: number;
  tone?: 'forest' | 'clay' | 'cream';
}) {
  return (
    <View className="mb-3.5">
      <View className="mb-1.5 flex-row items-center justify-between">
        <Text
          className={cn(
            'font-semibold text-base',
            tone === 'cream' ? 'text-cream/85' : 'text-ink-soft'
          )}>
          {label}
        </Text>
        <Text
          className={cn('font-extrabold text-base', tone === 'cream' ? 'text-cream' : 'text-forest')}>
          {value}%
        </Text>
      </View>
      <ProgressBar value={value} delay={delay} tone={tone} height={7} />
    </View>
  );
}

/** Step dots for the foster wizard. */
export function StepProgress({ step, total }: { step: number; total: number }) {
  return (
    <View className="w-full">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="font-extrabold text-xs uppercase tracking-[1.6px] text-ink-muted">
          Step {step} of {total}
        </Text>
        <Text className="font-bold text-sm text-forest">
          {Math.round((step / total) * 100)}%
        </Text>
      </View>
      <View className="flex-row gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full',
              i < step ? 'bg-forest' : 'bg-beige-dark'
            )}
          />
        ))}
      </View>
    </View>
  );
}
