import * as Haptics from 'expo-haptics';
import React, { useCallback } from 'react';
import {
  Platform,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  className?: string;
  style?: StyleProp<ViewStyle>;
  /** How far the element scales down on press. */
  scaleTo?: number;
  haptic?: false | 'light' | 'medium';
  children?: React.ReactNode;
};

/**
 * The single press primitive for the whole app: a gentle spring scale plus
 * optional haptic tick. Every tappable surface uses this so touch feedback is
 * identical everywhere.
 */
export function PressableScale({
  scaleTo = 0.97,
  haptic = 'light',
  onPressIn,
  onPress,
  className,
  style,
  children,
  ...rest
}: Props) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback<NonNullable<PressableProps['onPressIn']>>(
    (event) => {
      scale.value = withSpring(scaleTo, { damping: 18, stiffness: 320 });
      onPressIn?.(event);
    },
    [onPressIn, scale, scaleTo]
  );

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 16, stiffness: 260 });
  }, [scale]);

  const handlePress = useCallback<NonNullable<PressableProps['onPress']>>(
    (event) => {
      if (haptic && Platform.OS !== 'web') {
        const style_ =
          haptic === 'medium'
            ? Haptics.ImpactFeedbackStyle.Medium
            : Haptics.ImpactFeedbackStyle.Light;
        Haptics.impactAsync(style_).catch(() => undefined);
      }
      onPress?.(event);
    },
    [haptic, onPress]
  );

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      className={className}
      style={[animatedStyle, style]}>
      {children}
    </AnimatedPressable>
  );
}
