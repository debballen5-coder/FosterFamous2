import { PawPrint } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

/**
 * A sparse scatter of paw prints used behind hero areas. Deliberately quiet —
 * paws are an accent in this app, never wallpaper.
 */
const SCATTER = [
  { top: 12, left: 18, size: 22, rotate: '-18deg', opacity: 0.1 },
  { top: 74, left: 300, size: 16, rotate: '22deg', opacity: 0.09 },
  { top: 150, left: 34, size: 14, rotate: '8deg', opacity: 0.08 },
  { top: 206, left: 286, size: 24, rotate: '-30deg', opacity: 0.07 },
  { top: 42, left: 176, size: 12, rotate: '40deg', opacity: 0.07 },
];

export function PawPattern({ color, height = 260 }: { color: string; height?: number }) {
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height, overflow: 'hidden' }}>
      {SCATTER.map((p, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: p.top,
            left: p.left,
            opacity: p.opacity,
            transform: [{ rotate: p.rotate }],
          }}>
          <PawPrint size={p.size} color={color} strokeWidth={2.2} />
        </View>
      ))}
    </View>
  );
}
