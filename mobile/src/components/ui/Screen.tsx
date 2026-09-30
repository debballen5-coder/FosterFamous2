import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import React from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { cn } from '@/lib/cn';
import { goBackOrReplace } from '@/lib/navigation';
import { colors } from '@/lib/theme';

import { PressableScale } from './Pressables';

/**
 * The app's canvas. A warm cream base with a barely-there gradient wash at the
 * top so screens have depth without any of the flat-solid or neon-gradient
 * look. All headers in the app are custom, so screens own their safe area.
 */
export function Screen({
  children,
  edges = ['top'],
  className,
  testID,
}: {
  children: React.ReactNode;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  className?: string;
  testID?: string;
}) {
  return (
    <View className="flex-1 bg-cream" testID={testID}>
      <LinearGradient
        colors={[colors.creamDeep, colors.cream]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 0.45 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 380 }}
      />
      <SafeAreaView edges={edges} className={cn('flex-1', className)}>
        {children}
      </SafeAreaView>
    </View>
  );
}

/**
 * Custom screen header: back chevron, title, optional right slot.
 * Kept short and quiet so content stays the hero.
 */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
  showBack = true,
}: {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  showBack?: boolean;
}) {
  const router = useRouter();

  return (
    <View className="flex-row items-center px-5 pb-3 pt-1">
      {showBack ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Go back"
          testID="header-back-button"
          onPress={onBack ?? (() => goBackOrReplace(router, '/(tabs)/home'))}
          scaleTo={0.9}
          className="mr-3 h-11 w-11 items-center justify-center rounded-full border border-hairline bg-white">
          <ChevronLeft size={22} color={colors.forest} strokeWidth={2.4} />
        </PressableScale>
      ) : null}
      <View className="flex-1">
        {title ? (
          <Text className="font-display text-xl text-forest" numberOfLines={1}>
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text className="font-sans text-sm text-ink-muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View className="ml-3">{right}</View> : null}
    </View>
  );
}

/** Section heading with optional trailing action. */
export function SectionHeader({
  title,
  action,
  onAction,
  className,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <View className={cn('mb-3 flex-row items-end justify-between', className)}>
      <Text className="font-display text-xl text-forest">{title}</Text>
      {action ? (
        <PressableScale
          accessibilityRole="button"
          onPress={onAction}
          scaleTo={0.94}
          haptic={false}
          className="h-9 justify-center">
          <Text className="font-bold text-base text-clay-deep">{action}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}
