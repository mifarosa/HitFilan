// The "now" card of the video layouts: a rounded square with a soft gradient in the step's color, a
// progress frame that runs around its edge and the time, step and next step inside.
import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import type { WorkoutView } from '@/engine/useWorkout';
import { LEVELS, formatTime, loadSettings } from '@/shared';
import { colors, levelColor } from '@/theme';
import { roundedFrame } from './squarePath';

export function SquareCard({ view, hint }: { view: WorkoutView; hint?: string }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox((b) => (b.w === width && b.h === height ? b : { w: width, h: height }));
  };

  const step = view.step;
  const color = view.warn ? colors.warn : levelColor(step.level);
  const radius = 26;
  const stroke = 7;
  const frame = roundedFrame(box.w, box.h, radius, stroke / 2);
  const track = roundedFrame(box.w, box.h, radius, stroke / 2);

  const s = loadSettings();
  const res = step.level === 'easy' ? s.resEasy : step.level === 'moderate' ? s.resModerate : step.level === 'hard' ? s.resHard : null;
  const rpm = LEVELS[step.level]?.rpm;
  const time = step.open ? `${step.reps}×` : formatTime(view.remaining);
  const short = Math.min(box.w, box.h);

  return (
    <View style={styles.card} onLayout={onLayout}>
      {box.w > 0 && (
        <Svg width={box.w} height={box.h} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.3} />
              <Stop offset="1" stopColor={color} stopOpacity={0.05} />
            </LinearGradient>
          </Defs>
          <Rect x={stroke / 2} y={stroke / 2} width={box.w - stroke} height={box.h - stroke} rx={radius} fill="url(#bg)" />
          <Path d={track.path} stroke={colors.surface2} strokeWidth={stroke} fill="none" />
          <Path
            d={frame.path} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
            strokeDasharray={`${frame.length}`} strokeDashoffset={frame.length * (1 - view.progress)}
          />
        </Svg>
      )}
      <View style={styles.inner}>
        <Text style={[styles.tag, { color }]} numberOfLines={1}>{step.tag.toUpperCase()}</Text>
        <Text style={[styles.time, { fontSize: Math.max(34, short * 0.3), color: view.warn ? colors.warn : colors.text }]} adjustsFontSizeToFit numberOfLines={1}>
          {time}
        </Text>
        <Text style={[styles.name, { fontSize: Math.max(18, Math.min(30, short * 0.12)) }]} numberOfLines={2}>{step.label}</Text>
        {res != null && rpm ? <Text style={styles.target}>Direnç {res} · {rpm} rpm</Text> : null}
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        {view.next ? (
          <Text style={styles.next} numberOfLines={1}>
            Sıradaki: {view.next.label} · {view.next.open ? `${view.next.reps} tekrar` : formatTime(view.next.dur)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minHeight: 120 },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 12, gap: 2 },
  tag: { fontSize: 13, fontWeight: '800', letterSpacing: 1.2 },
  time: { fontWeight: '800', fontVariant: ['tabular-nums'], includeFontPadding: false },
  name: { color: colors.text, fontWeight: '800', textAlign: 'center' },
  target: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: 4 },
  hint: { color: colors.accent, fontSize: 14, fontWeight: '700', marginTop: 6 },
  next: { color: colors.muted, fontSize: 13, marginTop: 2 },
});
