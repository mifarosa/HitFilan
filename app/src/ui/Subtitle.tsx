// "Overlay" size: no card, the info sits on the video like a subtitle: time and step, resistance, next step,
// a thin progress line, and the 1 2 3 4 buttons just below. Tapping the text cycles the size.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { WorkoutView } from '@/engine/useWorkout';
import { LEVELS, formatTime, loadSettings } from '@/shared';
import { colors, levelColor } from '@/theme';
import { SizePicker } from './SizePicker';
import type { SideMode } from './sideLayout';

interface Props {
  view: WorkoutView;
  onPickMode: (mode: SideMode) => void;
  onCycle: () => void;
  onDone?: () => void;
}

export function Subtitle({ view, onPickMode, onCycle, onDone }: Props) {
  const step = view.step;
  const color = view.warn ? colors.warn : levelColor(step.level);
  const s = loadSettings();
  const res = step.level === 'easy' ? s.resEasy : step.level === 'moderate' ? s.resModerate : step.level === 'hard' ? s.resHard : null;
  const rpm = LEVELS[step.level]?.rpm;
  const time = step.open ? `${step.reps}×` : formatTime(view.remaining);
  const next = view.next ? `Sıradaki: ${view.next.label} · ${view.next.open ? `${view.next.reps}×` : formatTime(view.next.dur)}` : null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable onPress={onCycle} style={styles.box} accessibilityLabel="Boyutu değiştir">
        <Text style={styles.line1} numberOfLines={1}>
          <Text style={{ color }}>{time}</Text>
          <Text>{`  ${step.label}`}</Text>
          {res != null && rpm ? <Text style={styles.res}>{`  ·  Direnç ${res}`}</Text> : null}
        </Text>
        {next ? <Text style={styles.line2} numberOfLines={1}>{next}</Text> : null}
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(view.progress * 100)}%`, backgroundColor: color }]} />
        </View>
        {step.open && onDone ? (
          <Pressable onPress={onDone} style={styles.done} accessibilityRole="button" accessibilityLabel="Bitti">
            <Text style={styles.doneText}>✓ Bitti</Text>
          </Pressable>
        ) : null}
      </Pressable>
      <SizePicker mode="overlay" color={color} onPick={onPickMode} size={22} />
    </View>
  );
}

const SHADOW = { textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 };

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: '9%', alignItems: 'center', gap: 6 },
  box: { maxWidth: '92%', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', gap: 2 },
  line1: { color: '#fff', fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'], ...SHADOW },
  res: { color: '#fff', fontSize: 15, fontWeight: '700' },
  line2: { color: 'rgba(255,255,255,0.85)', fontSize: 13, ...SHADOW },
  track: { alignSelf: 'stretch', height: 3, borderRadius: 2, marginTop: 3, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  fill: { height: 3 },
  done: { marginTop: 4, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 14, backgroundColor: colors.easy },
  doneText: { color: '#08130e', fontWeight: '900', fontSize: 14 },
});
