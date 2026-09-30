import React from 'react';
import { Text, type TextProps } from 'react-native';

import { cn } from '@/lib/cn';

type Props = TextProps & { className?: string };

/** Big serif hero text. Used once per screen at most. */
export function Display({ className, ...rest }: Props) {
  return (
    <Text
      {...rest}
      className={cn('font-display text-4xl leading-[46px] text-forest', className)}
    />
  );
}

/** Screen / section title. */
export function Heading({ className, ...rest }: Props) {
  return (
    <Text
      {...rest}
      className={cn('font-display text-2xl leading-[32px] text-forest', className)}
    />
  );
}

/** Card title. */
export function Subheading({ className, ...rest }: Props) {
  return (
    <Text {...rest} className={cn('font-bold text-lg leading-[24px] text-ink', className)} />
  );
}

export function Body({ className, ...rest }: Props) {
  return (
    <Text {...rest} className={cn('font-sans text-base leading-[21px] text-ink-soft', className)} />
  );
}

/** Small uppercase eyebrow label. */
export function Overline({ className, ...rest }: Props) {
  return (
    <Text
      {...rest}
      className={cn('font-extrabold text-xs uppercase tracking-[1.6px] text-ink-muted', className)}
    />
  );
}

export function Label({ className, ...rest }: Props) {
  return (
    <Text {...rest} className={cn('font-semibold text-sm text-ink-muted', className)} />
  );
}

export function Caption({ className, ...rest }: Props) {
  return <Text {...rest} className={cn('font-sans text-sm text-ink-muted', className)} />;
}
