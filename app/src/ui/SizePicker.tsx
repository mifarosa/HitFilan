// The 1 2 3 4 buttons that pick the sideways size (full, half, quarter, overlay).
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';
import { SIDE_MODES, type SideMode } from './sideLayout';

interface Props {
  mode: SideMode;
  color: string;
  onPick: (mode: SideMode) => void;
  size?: number;
}

export function SizePicker({ mode, color, onPick, size = 24 }: Props) {
  return (
    <View style={styles.row}>
      {SIDE_MODES.map((m, i) => {
        const on = m === mode;
        return (
          <Pressable
            key={m} onPress={() => onPick(m)} hitSlop={4} accessibilityRole="button" accessibilityLabel={`Boyut ${i + 1}`}
            style={[styles.btn, { width: size, height: size, borderRadius: size / 2 }, on ? { backgroundColor: color } : styles.off]}
          >
            <Text style={[styles.num, { fontSize: size * 0.5, color: on ? colors.accentInk : colors.text }]}>{i + 1}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center' },
  btn: { alignItems: 'center', justifyContent: 'center' },
  off: { backgroundColor: 'rgba(33,43,53,0.85)', borderWidth: 1, borderColor: colors.line },
  num: { fontWeight: '800' },
});
