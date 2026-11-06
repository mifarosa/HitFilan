import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';
import { formatTime } from '@/shared';
import type { WorkoutView } from '@/engine/useWorkout';

/** Geçen / Kalan / ~kcal / Saat. `box` stacks them in a tinted card (video layouts), otherwise one flat row. */
export function Totals({ view, clock, box }: { view: WorkoutView; clock: string; box?: boolean }) {
  const remaining = Math.max(0, view.total - view.elapsed);
  const rows: [string, string][] = [
    ['Geçen', formatTime(view.elapsed)], ['Kalan', formatTime(remaining)], ['~kcal', String(view.kcal)], ['Saat', clock],
  ];
  if (!box) {
    return (
      <View style={styles.flat}>
        {rows.map(([label, value]) => (
          <View key={label} style={styles.cell}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.valueFlat}>{value}</Text>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={styles.box}>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.line}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flat: { flexDirection: 'row', justifyContent: 'space-between' },
  cell: { alignItems: 'center' },
  label: { color: colors.muted, fontSize: 13 },
  valueFlat: { color: colors.text, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  box: { gap: 6, padding: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  value: { color: colors.text, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
