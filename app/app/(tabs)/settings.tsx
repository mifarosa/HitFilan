import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loadSettings, saveSettings, type Settings } from '@/shared';
import { colors } from '@/theme';

type NumKey = 'weightKg' | 'resEasy' | 'resModerate' | 'resHard';
type FlagKey = 'beeps' | 'voice' | 'vibrate';

export default function SettingsScreen() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());

  const update = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  };
  // Typing "7," or "" must not wipe the field: only a finished number is saved.
  const num = (key: NumKey, text: string) => {
    const n = Number(text.replace(',', '.'));
    if (text.trim() !== '' && Number.isFinite(n) && n > 0) update({ [key]: n });
  };

  const field = (key: NumKey, label: string, hint?: string) => (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <TextInput
        style={styles.input} keyboardType="decimal-pad" defaultValue={String(settings[key])} selectTextOnFocus
        onChangeText={(t) => num(key, t)} accessibilityLabel={label}
      />
    </View>
  );
  const flag = (key: FlagKey, label: string, hint?: string) => (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Switch value={settings[key]} onValueChange={(v) => update({ [key]: v })} trackColor={{ true: colors.accent }} />
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Ayarlar</Text>
        <View style={styles.card}>
          {field('weightKg', 'Kilo (kg)', 'Kalori tahmini için')}
          {field('resEasy', 'Direnç: boşta', 'Bisikletindeki kademe numarası')}
          {field('resModerate', 'Direnç: orta')}
          {field('resHard', 'Direnç: ağır')}
        </View>
        <View style={styles.card}>
          {flag('beeps', 'Bip sesleri', 'Geri sayım, geçiş ve taraf değiştir sinyalleri')}
          {flag('voice', 'Sesli anons', 'Türkçe anons; bazı telefonlarda müziği anlık kısar')}
          {flag('vibrate', 'Titreşim')}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  card: { borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  label: { color: colors.text, fontSize: 16 },
  hint: { color: colors.muted, fontSize: 12, marginTop: 2 },
  input: { width: 84, textAlign: 'right', color: colors.text, fontSize: 17, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line },
});
