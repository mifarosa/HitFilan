// The "now" card of the video layouts: a rounded square with a soft gradient in the step's color, a
// progress frame that runs around its edge and the time, step and next step inside. Sideways it comes in
// three sizes (full, half, quarter): the smaller the card, the less it says and the more room the video has.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import type { WorkoutView } from '@/engine/useWorkout';
import { LEVELS, formatTime, loadSettings } from '@/shared';
import { colors, levelColor } from '@/theme';
import { roundedFrame } from './squarePath';
import type { SideMode } from './sideLayout';

interface Props {
  view: WorkoutView;
  mode?: SideMode;
  /** A rep step ends when the user says so: shows a check button that calls this. */
  onDone?: () => void;
}

const SIZES = {
  full: { radius: 26, stroke: 7 },
  half: { radius: 22, stroke: 6 },
  quarter: { radius: 18, stroke: 5 },
};

export function SquareCard({ view, mode = 'full', onDone }: Props) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox((b) => (b.w === width && b.h === height ? b : { w: width, h: height }));
  };

  const step = view.step;
  const color = view.warn ? colors.warn : levelColor(step.level);
  const { radius, stroke } = SIZES[mode];
  const frame = roundedFrame(box.w, box.h, radius, stroke / 2);

  const s = loadSettings();
  const res = step.level === 'easy' ? s.resEasy : step.level === 'moderate' ? s.resModerate : step.level === 'hard' ? s.resHard : null;
  const rpm = LEVELS[step.level]?.rpm;
  const time = step.open ? `${step.reps}×` : formatTime(view.remaining);
  const short = Math.min(box.w, box.h);
  const timeSize = mode === 'full' ? Math.max(34, short * 0.3) : mode === 'half' ? Math.max(26, Math.min(box.w * 0.3, box.h * 0.28)) : Math.max(22, box.w * 0.34);
  const nextLabel = view.next ? (view.next.open ? `${view.next.label} · ${view.next.reps}×` : `${view.next.label} · ${formatTime(view.next.dur)}`) : null;
  const doneSize = mode === 'quarter' ? 34 : 44;

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
          <Path d={frame.path} stroke={colors.surface2} strokeWidth={stroke} fill="none" />
          <Path
            d={frame.path} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
            strokeDasharray={`${frame.length}`} strokeDashoffset={frame.length * (1 - view.progress)}
          />
        </Svg>
      )}
      <View style={[styles.inner, mode !== 'full' && { paddingHorizontal: 8, paddingVertical: 8 }]}>
        {mode !== 'quarter' && <Text style={[styles.tag, { color }, mode === 'half' && { fontSize: 10 }]} numberOfLines={1}>{step.tag.toUpperCase()}</Text>}
        <Text style={[styles.time, { fontSize: timeSize, color: view.warn ? colors.warn : colors.text }]} adjustsFontSizeToFit numberOfLines={1}>
          {time}
        </Text>
        {mode !== 'quarter' && (
          <Text style={[styles.name, { fontSize: mode === 'half' ? 15 : Math.max(18, Math.min(30, short * 0.12)) }]} numberOfLines={2}>{step.label}</Text>
        )}
        {res != null && rpm ? (
          <Text style={[styles.target, mode !== 'full' && { fontSize: 11, marginTop: 2 }]} numberOfLines={1}>
            {mode === 'full' ? `Direnç ${res} · ${rpm} rpm` : `Direnç ${res}`}
          </Text>
        ) : null}
        {nextLabel ? (
          <Text style={[styles.next, mode !== 'full' && { fontSize: 10 }]} numberOfLines={1}>
            {mode === 'quarter' ? `› ${nextLabel}` : `Sıradaki: ${nextLabel}`}
          </Text>
        ) : null}
        {step.open && onDone ? (
          <Pressable
            onPress={onDone} accessibilityRole="button" accessibilityLabel="Bitti"
            style={[styles.done, { width: doneSize, height: doneSize, borderRadius: doneSize / 2 }]}
          >
            <Text style={styles.doneText}>✓</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.dots} pointerEvents="none">
        {(['full', 'half', 'quarter'] as const).map((m) => (
          <View key={m} style={[styles.dot, { backgroundColor: m === mode ? color : colors.line }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minHeight: 100 },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 12, gap: 2 },
  tag: { fontSize: 13, fontWeight: '800', letterSpacing: 1.2 },
  time: { fontWeight: '800', fontVariant: ['tabular-nums'], includeFontPadding: false },
  name: { color: colors.text, fontWeight: '800', textAlign: 'center' },
  target: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: 4 },
  next: { color: colors.muted, fontSize: 13, marginTop: 2 },
  done: { marginTop: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.easy },
  doneText: { color: '#08130e', fontSize: 22, fontWeight: '900' },
  dots: { position: 'absolute', top: 10, right: 14, flexDirection: 'row', gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
