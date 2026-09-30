import { ChevronDown } from 'lucide-react-native';
import React from 'react';
import { Text, TextInput, type TextInputProps, View } from 'react-native';

import { cn } from '@/lib/cn';
import { colors } from '@/lib/theme';

import { PressableScale } from './Pressables';

/** Shared form primitives for local Foster Famous workflows. */

export function FieldLabel({ children }: { children: string }) {
  return (
    <Text className="mb-2 font-extrabold text-xs uppercase tracking-[1.4px] text-ink-muted">
      {children}
    </Text>
  );
}

interface TextFieldProps {
  label: string;
  placeholder?: string;
  value?: string;
  onChangeText?: (v: string) => void;
  multiline?: boolean;
  hint?: string;
  returnKeyType?: TextInputProps['returnKeyType'];
  submitBehavior?: TextInputProps['submitBehavior'];
  testID?: string;
}

export function TextField({
  label,
  placeholder,
  value,
  onChangeText,
  multiline = false,
  hint,
  returnKeyType,
  submitBehavior,
  testID,
}: TextFieldProps) {
  return (
    <View className="mb-5">
      <FieldLabel>{label}</FieldLabel>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkMuted}
        multiline={multiline}
        returnKeyType={returnKeyType ?? (multiline ? 'default' : 'done')}
        submitBehavior={submitBehavior}
        style={{ fontFamily: 'Nunito_500Medium', fontSize: 16, color: colors.ink }}
        className={cn(
          'rounded-2xl border border-hairline bg-white px-4',
          multiline ? 'min-h-[104px] py-3.5' : 'h-[54px]'
        )}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
      {hint ? <Text className="mt-1.5 font-sans text-sm text-ink-muted">{hint}</Text> : null}
    </View>
  );
}

/** Tappable row used when a screen provides a picker action. */
export function SelectField({
  label,
  value,
  placeholder = 'Select',
  onPress,
  testID,
}: {
  label: string;
  value?: string | null;
  placeholder?: string;
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <View className="mb-5">
      <FieldLabel>{label}</FieldLabel>
      <PressableScale
        testID={testID}
        accessibilityRole="button"
        onPress={onPress}
        scaleTo={0.985}
        className="h-[54px] flex-row items-center justify-between rounded-2xl border border-hairline bg-white px-4">
        <Text
          className={cn('font-medium text-lg', value ? 'text-ink' : 'text-ink-muted')}
          numberOfLines={1}>
          {value ?? placeholder}
        </Text>
        <ChevronDown size={19} color={colors.inkMuted} />
      </PressableScale>
    </View>
  );
}

/**
 * Horizontal set of mutually exclusive options. Used for Yes / No / Unknown /
 * Still evaluating — the tri-state answers that must never collapse into a
 * boolean.
 */
export function OptionGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  columns = 2,
  hint,
}: {
  label: string;
  options: readonly T[];
  value: T | null;
  onChange: (v: T) => void;
  columns?: 2 | 3;
  hint?: string;
}) {
  return (
    <View className="mb-5">
      <FieldLabel>{label}</FieldLabel>
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => {
          const selected = value === option;
          return (
            <PressableScale
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(option)}
              scaleTo={0.95}
              style={{ width: columns === 3 ? '31.5%' : '48.5%' }}
              className={cn(
                'h-[50px] items-center justify-center rounded-2xl border px-2',
                selected ? 'border-forest bg-forest' : 'border-hairline bg-white'
              )}>
              <Text
                numberOfLines={2}
                className={cn(
                  'text-center font-bold text-base',
                  selected ? 'text-cream' : 'text-ink-soft'
                )}>
                {option}
              </Text>
            </PressableScale>
          );
        })}
      </View>
      {hint ? <Text className="mt-2 font-sans text-sm text-ink-muted">{hint}</Text> : null}
    </View>
  );
}
