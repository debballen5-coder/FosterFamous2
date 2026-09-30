import React from 'react';
import { Text, View } from 'react-native';

import { Button } from './Button';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  testID?: string;
}

/**
 * Friendly, never scolding. Empty states in Foster Famous always tell the
 * foster parent what good thing happens next.
 */
export function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  testID,
}: EmptyStateProps) {
  return (
    <View
      testID={testID}
      className="items-center rounded-4xl border border-dashed border-hairline bg-cream-deep/70 px-6 py-9">
      <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-beige">
        {icon}
      </View>
      <Text className="mb-2 text-center font-display text-xl text-forest">{title}</Text>
      <Text className="mb-5 max-w-[280px] text-center font-sans text-base leading-[21px] text-ink-muted">
        {body}
      </Text>
      {actionLabel ? (
        <View className="w-full gap-2">
          <Button label={actionLabel} onPress={onAction} size="md" fullWidth={false} />
          {secondaryActionLabel ? <Button label={secondaryActionLabel} onPress={onSecondaryAction} variant="ghost" size="md" fullWidth={false} /> : null}
        </View>
      ) : null}
    </View>
  );
}
