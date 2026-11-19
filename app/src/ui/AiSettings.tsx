import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { AiError, PROVIDERS, testConnection, type Provider } from '@/ai/providers';
import { deleteKey, getKey, loadAiPrefs, modelOf, saveAiPrefs, setKey, type AiPrefs } from '@/ai/keyStore';
import { colors } from '@/theme';

// Settings > "Yapay zekâ": provider, own API key (kept in the phone's secure storage), model, connection test.
export function AiSettings() {
  const [prefs, setPrefs] = useState<AiPrefs>(() => loadAiPrefs());
  const [key, setKeyText] = useState('');
  const [saved, setSaved] = useState(false);
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const p = prefs.provider;

  useEffect(() => {
    let alive = true;
    setShow(false);
    setStatus('');
    getKey(p).then((k) => { if (alive) { setKeyText(k); setSaved(!!k); } });
    return () => { alive = false; };
  }, [p]);

  const update = (patch: Partial<AiPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    saveAiPrefs(next);
  };

  const save = async () => {
    if (!key.trim()) return;
    await setKey(p, key);
    setSaved(true);
    setStatus('Anahtar bu telefonun güvenli deposuna kaydedildi.');
  };

  const remove = async () => {
    await deleteKey(p);
    setKeyText('');
    setSaved(false);
    setStatus('Anahtar silindi.');
  };

  const consent = () => new Promise<boolean>((resolve) => {
    if (prefs.consented.includes(p)) return resolve(true);
    Alert.alert(
      `${PROVIDERS[p].label} kullanılsın mı?`,
      `Yazdığın sorular${prefs.sendContext ? ' ve günlük kalori ihtiyacın ile bugün harcadığın kalori' : ''} doğrudan ${PROVIDERS[p].label} sunucularına gider; bizden geçmez. Ücret ve kota senin hesabından düşer.`,
      [
        { text: 'Vazgeç', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Kabul et', onPress: () => { update({ consented: [...prefs.consented, p] }); resolve(true); } },
      ],
    );
  });

  const test = async () => {
    if (!key.trim()) return setStatus('Önce anahtarı gir.');
    if (!(await consent())) return;
    await save();
    setBusy(true);
    setStatus('Deneniyor…');
    try {
      await testConnection(p, modelOf(prefs), key.trim());
      setStatus('Bağlantı çalışıyor.');
    } catch (e) {
      setStatus(e instanceof AiError ? e.message : 'Bağlantı denenemedi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ paddingBottom: 12 }}>
      <Text style={styles.hint}>
        Kendi API anahtarını gir; sorular telefondan doğrudan seçtiğin sağlayıcıya gider. Anahtar yalnızca bu telefonun güvenli deposunda durur (yedeğe ve buluta gitmez).
      </Text>
      <View style={styles.segs}>
        {(Object.keys(PROVIDERS) as Provider[]).map((id) => (
          <Pressable key={id} onPress={() => update({ provider: id })} style={[styles.seg, id === p && styles.segOn]} accessibilityRole="button">
            <Text style={[styles.segText, id === p && styles.segTextOn]}>{PROVIDERS[id].label.split(' ')[0]}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>API anahtarı {saved ? '· kayıtlı' : ''}</Text>
      <View style={styles.keyRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]} value={key} onChangeText={(t) => { setKeyText(t); setSaved(false); }}
          placeholder={PROVIDERS[p].keyHint} placeholderTextColor={colors.muted}
          secureTextEntry={!show} autoCapitalize="none" autoCorrect={false} textContentType="none" accessibilityLabel="API anahtarı"
        />
        <Pressable onPress={() => setShow((s) => !s)} style={styles.small} accessibilityRole="button">
          <Text style={styles.smallText}>{show ? 'Gizle' : 'Göster'}</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>Almak için: {PROVIDERS[p].keyUrl}</Text>
      <Text style={styles.label}>Model</Text>
      <TextInput
        style={styles.input} value={prefs.models[p] ?? ''} placeholder={PROVIDERS[p].defaultModel} placeholderTextColor={colors.muted}
        onChangeText={(t) => update({ models: { ...prefs.models, [p]: t } })} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Model"
      />
      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.labelBig}>Bağlamı gönder</Text>
          <Text style={styles.hint}>Sorulara yalnızca günlük kalori ihtiyacın ve bugün harcadığın kalori eklenir</Text>
        </View>
        <Switch value={prefs.sendContext} onValueChange={(v) => update({ sendContext: v })} trackColor={{ true: colors.accent }} />
      </View>
      <View style={styles.buttons}>
        <Pressable onPress={test} disabled={busy} style={[styles.btn, busy && { opacity: 0.5 }]} accessibilityRole="button">
          <Text style={styles.btnText}>Bağlantıyı dene</Text>
        </Pressable>
        <Pressable onPress={save} style={styles.btnGhost} accessibilityRole="button"><Text style={styles.ghostText}>Kaydet</Text></Pressable>
        {saved ? <Pressable onPress={remove} style={styles.btnGhost} accessibilityRole="button"><Text style={[styles.ghostText, { color: colors.hard }]}>Anahtarı sil</Text></Pressable> : null}
      </View>
      {status ? <Text style={styles.status}>{status}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.muted, fontSize: 13, marginTop: 6 },
  segs: { flexDirection: 'row', gap: 8, marginTop: 12 },
  seg: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line },
  segOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  segText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  segTextOn: { color: colors.accentInk },
  label: { color: colors.muted, fontSize: 13, marginTop: 14, marginBottom: 6 },
  labelBig: { color: colors.text, fontSize: 16 },
  keyRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { color: colors.text, fontSize: 16, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line },
  small: { paddingVertical: 10, paddingHorizontal: 12 },
  smallText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  btn: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  btnText: { color: colors.accentInk, fontSize: 13, fontWeight: '700' },
  btnGhost: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line },
  ghostText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  status: { color: colors.text, fontSize: 13, marginTop: 10 },
});
