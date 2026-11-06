import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BIKE_MINUTES, PROGRAMS, buildSteps, estimateKcal, loadSettings, programInfo, saveSettings, totalSeconds,
} from '@/shared';
import { colors } from '@/theme';

export default function Home() {
  const router = useRouter();
  const [bikeId, setBikeId] = useState(() => loadSettings().bikeId);

  const cards = useMemo(() => {
    const s = loadSettings();
    // Bike flows are picked with the chips, so the list shows only the chosen one.
    return PROGRAMS.filter((p) => p.kind !== 'bike' || p.id === bikeId).map((p) => {
      const steps = buildSteps(p.id, { bikeId });
      const info = programInfo(p.id, { bikeId });
      const min = Math.round(totalSeconds(steps) / 60);
      return { id: p.id, name: info.name, desc: info.desc, meta: `${min} dk · ~${estimateKcal(steps, s.weightKg)} kcal` };
    });
  }, [bikeId]);

  const pickBike = (min: number) => {
    const id = `bike${min}`;
    setBikeId(id);
    saveSettings({ ...loadSettings(), bikeId: id });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.logo}>Hit<Text style={{ color: colors.accent }}>Filan</Text></Text>
        <Text style={styles.section}>Bisiklet akışı</Text>
        <View style={styles.chips}>
          {BIKE_MINUTES.map((min) => (
            <Pressable key={min} onPress={() => pickBike(min)} style={[styles.chip, bikeId === `bike${min}` && styles.chipOn]}>
              <Text style={[styles.chipText, bikeId === `bike${min}` && styles.chipTextOn]}>{min} dk</Text>
            </Pressable>
          ))}
        </View>
        {cards.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => router.push({ pathname: '/workout', params: { id: c.id, bike: bikeId } })}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.cardName}>{c.name}</Text>
            <Text style={styles.cardDesc}>{c.desc}</Text>
            <Text style={styles.cardMeta}>{c.meta}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 10 },
  logo: { color: colors.text, fontSize: 26, fontWeight: '800', marginBottom: 4 },
  section: { color: colors.muted, fontSize: 13, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.text, fontWeight: '600' },
  chipTextOn: { color: colors.accentInk },
  card: { padding: 16, borderRadius: 18, gap: 4, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  cardName: { color: colors.text, fontSize: 18, fontWeight: '700' },
  cardDesc: { color: colors.muted, fontSize: 14 },
  cardMeta: { color: colors.accent, fontSize: 13, fontWeight: '600', marginTop: 4 },
});
