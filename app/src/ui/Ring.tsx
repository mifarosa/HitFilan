import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '@/theme';

interface Props {
  size: number;
  progress: number; // 0..1
  color: string;
  time: string;
  warn?: boolean;
}

/** The countdown ring: time in the middle, progress arc in the step's color. */
export function Ring({ size, progress, color, time, warn }: Props) {
  const stroke = Math.max(6, size * 0.08);
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surface2} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={r} stroke={warn ? colors.warn : color} strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={`${len}`} strokeDashoffset={len * (1 - progress)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Text style={[styles.time, { fontSize: size * 0.24, color: warn ? colors.warn : colors.text }]}>{time}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  time: { fontWeight: '800', fontVariant: ['tabular-nums'] },
});
