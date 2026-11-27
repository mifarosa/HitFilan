import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { addHistory, loadSettings, walkDetails, walkEntry } from '@/shared';
import { colors } from '@/theme';

const DAYS = [['Bugün', 0], ['Dün', 1], ['2 gün önce', 2]] as const;
const pad = (n: number) => String(n).padStart(2, '0');

// "I walked 45 min, 4 km": saved as a normal history entry, so it counts as a workout that day.
// Time or distance may be left empty; the missing one is estimated at 5 km/h (shown with "~").
export function WalkCard() {
  const [open, setOpen] = useState(false);
  const [back, setBack] = useState(0);
  const [time, setTime] = useState('');
  const [minutes, setMinutes] = useState('');
  const [km, setKm] = useState('');
  const [message, setMessage] = useState('');

  const show = () => {
    const now = new Date();
    setTime(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
    setBack(0); setMinutes(''); setKm(''); setMessage('');
    setOpen(true);
  };

  const weightKg = loadSettings().weightKg;
  const d = walkDetails({ minutes, km, weightKg });
  const typed = minutes.trim() !== '' || km.trim() !== '';
  const preview = typed ? (d.ok ? `${d.estimated ? '~' : ''}${d.minutes} dk · ${d.estimated ? '~' : ''}${String(d.km).replace('.', ',')} km · ~${d.kcal} kcal` : d.error) : '';

  const save = () => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
    if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return setMessage('Saati 18:30 gibi yaz.');
    const when = new Date();
    when.setDate(when.getDate() - back);
    when.setHours(Number(m[1]), Number(m[2]), 0, 0);
    if (when.getTime() > Date.now() + 60000) return setMessage('Gelecek bir saat girilemez.');
    const entry = walkEntry({ date: when.toISOString(), minutes, km, weightKg });
    if (!entry) return setMessage(d.error ?? 'Süre veya mesafeyi kontrol et.');
    addHistory(entry);
    setOpen(false);
    setMessage(`Yürüyüş eklendi: ${d.minutes} dk, ~${d.kcal} kcal. O gün antrenman sayıldı.`);
  };

  if (!open) {
    return (
      <View style={styles.wrap}>
        <Pressable onPress={show} style={styles.ghost} accessibilityRole="button"><Text style={styles.ghostText}>+ Yürüyüş ekle</Text></Pressable>
        {message ? <Text style={styles.hint}>{message}</Text> : null}
      </View>
    );
  }
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Yürüyüş ekle</Text>
      <Text style={styles.hint}>Süre veya mesafeden birini boş bırakabilirsin; eksik olanı saatte 5 km hızla tahmin ederiz (~).</Text>
      <View style={styles.row}>
        {DAYS.map(([label, n]) => (
          <Pressable key={n} onPress={() => setBack(n)} style={[styles.chip, back === n && styles.chipOn]} accessibilityRole="button">
            <Text style={[styles.chipText, back === n && styles.chipTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.row}>
        <Field label="Saat" value={time} onChange={setTime} placeholder="18:30" keyboard="numbers-and-punctuation" />
        <Field label="Süre (dk)" value={minutes} onChange={setMinutes} placeholder="45" keyboard="number-pad" />
        <Field label="Mesafe (km)" value={km} onChange={setKm} placeholder="4,5" keyboard="decimal-pad" />
      </View>
      {preview ? <Text style={styles.preview}>{preview}</Text> : null}
      {message ? <Text style={styles.error}>{message}</Text> : null}
      <View style={styles.row}>
        <Pressable onPress={save} style={styles.primary} accessibilityRole="button"><Text style={styles.primaryText}>Ekle</Text></Pressable>
        <Pressable onPress={() => setOpen(false)} style={styles.ghost} accessibilityRole="button"><Text style={styles.ghostText}>Vazgeç</Text></Pressable>
      </View>
    </View>
  );
}

function Field({ label, value, onChange, placeholder, keyboard }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string;
  keyboard: 'number-pad' | 'decimal-pad' | 'numbers-and-punctuation';
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.hint}>{label}</Text>
      <TextInput
        style={styles.input} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.muted}
        keyboardType={keyboard} accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  card: { padding: 16, borderRadius: 18, gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 13 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  chipTextOn: { color: colors.accentInk },
  input: { color: colors.text, fontSize: 16, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line, marginTop: 4 },
  preview: { color: colors.text, fontSize: 13 },
  error: { color: colors.hard, fontSize: 13 },
  primary: { flex: 1, backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: colors.accentInk, fontSize: 16, fontWeight: '700' },
  ghost: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.line },
  ghostText: { color: colors.text, fontSize: 13, fontWeight: '700' },
});
