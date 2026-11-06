import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors } from '@/theme';

type Glyph = 'prev' | 'next' | 'play' | 'pause' | 'done';

function Icon({ glyph, size, color }: { glyph: Glyph; size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {glyph === 'play' && <Path d="M8 4.5 L20 12 L8 19.5 Z" fill={color} />}
      {glyph === 'pause' && (
        <>
          <Rect x="6.5" y="4.5" width="4" height="15" fill={color} />
          <Rect x="13.5" y="4.5" width="4" height="15" fill={color} />
        </>
      )}
      {glyph === 'next' && (
        <>
          <Path d="M6 6 L16.5 12 L6 18 Z" fill={color} />
          <Rect x="17.5" y="6" width="1.8" height="12" fill={color} />
        </>
      )}
      {glyph === 'prev' && (
        <>
          <Path d="M18 6 L7.5 12 L18 18 Z" fill={color} />
          <Rect x="4.7" y="6" width="1.8" height="12" fill={color} />
        </>
      )}
      {glyph === 'done' && <Path d="M5 12.5 L10 17.5 L19.5 7" stroke={color} strokeWidth={2.4} strokeLinecap="round" fill="none" />}
    </Svg>
  );
}

interface RoundProps {
  glyph: Glyph;
  size: number;
  bg: string;
  fg: string;
  label: string;
  onPress: () => void;
}

function Round({ glyph, size, bg, fg, label, onPress }: RoundProps) {
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => [{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, opacity: pressed ? 0.7 : 1 }, styles.center]}
    >
      <Icon glyph={glyph} size={size * 0.5} color={fg} />
    </Pressable>
  );
}

interface Props {
  running: boolean;
  open: boolean; // a rep step: the big button says "done"
  small?: boolean;
  onPrev: () => void;
  onToggle: () => void;
  onNext: () => void;
}

/** Previous / play-pause (done on a rep step) / next. */
export function Controls({ running, open, small, onPrev, onToggle, onNext }: Props) {
  const side = small ? 40 : 56;
  const main = small ? 52 : 76;
  return (
    <View style={[styles.row, { gap: small ? 8 : 22 }]}>
      <Round glyph="prev" size={side} bg={colors.surface2} fg={colors.text} label="Önceki" onPress={onPrev} />
      {open && running
        ? <Round glyph="done" size={main} bg={colors.easy} fg="#08130e" label="Bitti" onPress={onToggle} />
        : <Round glyph={running ? 'pause' : 'play'} size={main} bg={colors.text} fg={colors.bg} label="Başlat/Duraklat" onPress={onToggle} />}
      <Round glyph="next" size={side} bg={colors.surface2} fg={colors.text} label="Sonraki" onPress={onNext} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
