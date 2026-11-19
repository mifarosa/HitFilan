import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addMeals, analyzeMeal, askCoach, commentDay, deleteMeal, proposePlan, savePlan, todayMeals, type AiConfig } from '@/ai/features';
import { getKey, loadAiPrefs, modelOf } from '@/ai/keyStore';
import { AiError, PROVIDERS } from '@/ai/providers';
import {
  EXERCISES, MEAL_SLOTS, loadHistory, loadMeals, loadSettings, periodRange, periodTotals, slotForHour, slotLabel,
  type MealItem, type SlotId, type ValidPlan,
} from '@/shared';
import { colors } from '@/theme';

type Tab = 'ask' | 'plan' | 'meal';
const TABS: [Tab, string][] = [['ask', 'Sor'], ['plan', 'Plan kur'], ['meal', 'Öğün']];

export default function Coach() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('ask');
  const [cfg, setCfg] = useState<Omit<AiConfig, 'signal'> | null>(null);
  const [ready, setReady] = useState(false);
  const abort = useRef<AbortController | null>(null);

  // Re-read the key and prefs every time the screen is shown (they are edited in Settings).
  const refresh = async () => {
    const prefs = loadAiPrefs();
    const key = await getKey(prefs.provider);
    setCfg(key && prefs.consented.includes(prefs.provider)
      ? { provider: prefs.provider, model: modelOf(prefs), key, sendContext: prefs.sendContext }
      : null);
    setReady(true);
  };
  useEffect(() => { refresh(); }, []);
  useEffect(() => () => abort.current?.abort(), []);

  const run = async <T,>(fn: (c: AiConfig) => Promise<T>): Promise<T | { error: string }> => {
    if (!cfg) return { error: 'Önce Ayarlar > Yapay zekâ bölümünden anahtarını gir ve bağlantıyı dene.' };
    abort.current?.abort();
    abort.current = new AbortController();
    try {
      return await fn({ ...cfg, signal: abort.current.signal });
    } catch (e) {
      return { error: e instanceof AiError ? e.message : 'Bir şey ters gitti.' };
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.head}>
          <Text style={styles.title}>Koç</Text>
          <View style={styles.segs}>
            {TABS.map(([id, label]) => (
              <Pressable key={id} onPress={() => setTab(id)} style={[styles.seg, tab === id && styles.segOn]} accessibilityRole="button">
                <Text style={[styles.segText, tab === id && styles.segTextOn]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          {ready && !cfg ? (
            <Pressable onPress={refresh} style={styles.notice}>
              <Text style={styles.noticeText}>Yapay zekâ kapalı. Ayarlar'dan {Object.values(PROVIDERS).map((p) => p.label.split(' ')[0]).join(' / ')} anahtarını girip "Bağlantıyı dene"ye bas, sonra buraya dön ve yenile.</Text>
              <Text style={styles.noticeLink}>Yenile</Text>
            </Pressable>
          ) : null}
        </View>
        {tab === 'ask' ? <Ask run={run} /> : null}
        {tab === 'plan' ? <PlanBuilder run={run} onOpenHome={() => router.push('/')} /> : null}
        {tab === 'meal' ? <Meals run={run} /> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type Run = <T>(fn: (c: AiConfig) => Promise<T>) => Promise<T | { error: string }>;
const isError = (v: unknown): v is { error: string } => !!v && typeof v === 'object' && 'error' in (v as object);

function Ask({ run }: { run: Run }) {
  const [text, setText] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    const q = text.trim();
    if (!q || busy) return;
    setError(''); setAnswer(''); setBusy(true);
    const r = await run((c) => askCoach(q, c));
    if (isError(r)) setError(r.error);
    else setAnswer(r);
    setBusy(false);
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.hint}>Antrenman, toparlanma ya da beslenme hakkında sor. Her soru tek başına gider; yanında yalnızca günlük kalori ihtiyacın ve bugün harcadığın kalori olur. Yanıtlar tahmindir, tıbbi tavsiye değildir.</Text>
      <TextInput style={[styles.input, { minHeight: 80 }]} value={text} onChangeText={setText} placeholder="Bir şey sor…" placeholderTextColor={colors.muted} multiline maxLength={1000} accessibilityLabel="Soru" />
      <Pressable onPress={send} disabled={busy || !text.trim()} style={[styles.primary, (busy || !text.trim()) && { opacity: 0.4 }]} accessibilityRole="button">
        <Text style={styles.primaryText}>{busy ? 'Düşünüyor…' : 'Sor'}</Text>
      </Pressable>
      {busy ? <ActivityIndicator color={colors.accent} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {answer ? <View style={styles.card}><Text style={styles.answer} selectable>{answer}</Text></View> : null}
    </ScrollView>
  );
}

function PlanBuilder({ run, onOpenHome }: { run: Run; onOpenHome: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState<ValidPlan | null>(null);
  const [saved, setSaved] = useState(false);

  const make = async () => {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true); setError(''); setPlan(null); setSaved(false);
    const r = await run((c) => proposePlan(q, c));
    if (isError(r)) setError(r.error);
    else if (!r) setError('Kullanılabilir bir plan çıkmadı. İsteği biraz daha açık yazıp tekrar dene.');
    else setPlan(r);
    setBusy(false);
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.hint}>Ne istediğini yaz: süre, hedef, ekipman. Örn. "30 dk, dumbbell var, göğüs ve sırt".</Text>
      <TextInput style={[styles.input, { minHeight: 80 }]} value={text} onChangeText={setText} multiline maxLength={500} placeholder="İsteğin…" placeholderTextColor={colors.muted} accessibilityLabel="Plan isteği" />
      <Pressable onPress={make} disabled={busy || !text.trim()} style={[styles.primary, (busy || !text.trim()) && { opacity: 0.4 }]} accessibilityRole="button">
        <Text style={styles.primaryText}>{busy ? 'Hazırlanıyor…' : 'Plan öner'}</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {plan ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{plan.name}</Text>
          {plan.note ? <Text style={styles.hint}>{plan.note}</Text> : null}
          {plan.items.map((it, i) => (
            <Text key={i} style={styles.row}>
              {EXERCISES[it.exercise]?.name ?? it.exercise} · {it.sets}×{it.reps ? `${it.reps} tekrar` : `${it.dur} sn`}{it.kg ? ` · ${it.kg} kg` : ''}
            </Text>
          ))}
          {plan.dropped ? <Text style={styles.hint}>{plan.dropped} hareket listede olmadığı için çıkarıldı.</Text> : null}
          {saved ? (
            <Pressable onPress={onOpenHome}><Text style={styles.link}>Kaydedildi. Ana sayfada "Planlarım"da.</Text></Pressable>
          ) : (
            <Pressable onPress={() => { savePlan(plan); setSaved(true); }} style={styles.primary} accessibilityRole="button">
              <Text style={styles.primaryText}>Planlarıma kaydet</Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

const PERIODS: ['day' | 'week' | 'month', string][] = [['day', 'Gün'], ['week', 'Hafta'], ['month', 'Ay']];
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
const sign = (n: number) => (n > 0 ? `+${n}` : String(n));

function Meals({ run }: { run: Run }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<MealItem[] | null>(null);
  const [slot, setSlot] = useState<SlotId>(() => slotForHour(new Date().getHours()));
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');
  const [comment, setComment] = useState('');
  const [commenting, setCommenting] = useState(false);
  const [, bump] = useState(0);

  const analyze = async () => {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true); setError(''); setItems(null);
    setSlot(slotForHour(new Date().getHours()));
    const r = await run((c) => analyzeMeal(q, c));
    if (isError(r)) setError(r.error);
    else if (!r.length) setError('Bir şey çıkaramadım. Ne yediğini biraz daha açık yaz.');
    else setItems(r);
    setBusy(false);
  };

  const discuss = async () => {
    setCommenting(true); setComment(''); setError('');
    const r = await run((c) => commentDay(c));
    if (isError(r)) setError(r.error); else setComment(r);
    setCommenting(false);
  };

  const meals = todayMeals();
  const { from, to } = periodRange(period);
  const t = periodTotals({ meals: loadMeals(), history: loadHistory(), settings: loadSettings(), from, to });
  const missing = t.target === 0;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <View style={styles.segs}>
          {PERIODS.map(([id, label]) => (
            <Pressable key={id} onPress={() => setPeriod(id)} style={[styles.seg, period === id && styles.segOn]} accessibilityRole="button">
              <Text style={[styles.segText, period === id && styles.segTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.big}>{sign(t.balance)} kcal</Text>
        <Text style={styles.row}>Yenen {t.eaten} · Yakılan ~{t.burned} · İhtiyaç {t.target}</Text>
        {missing ? <Text style={styles.hint}>İhtiyaç hesaplanamadı: Ayarlar'dan kilo, boy, yaş ve cinsiyeti gir.</Text> : null}
        {period !== 'day' ? (
          <>
            <Text style={styles.hint}>
              {t.logged} günde kayıt var{t.logged ? ` · günlük ortalama yenen ${Math.round(t.eaten / t.logged)} kcal` : ''}. Pozitif fazla, negatif açık demek.
            </Text>
            {t.days.map((d) => (
              <Text key={d.day} style={[styles.row, !d.logged && { color: colors.muted }]}>
                {d.day.slice(8)}.{d.day.slice(5, 7)} · {d.logged ? `yenen ${d.eaten} · ${sign(d.balance)}` : 'kayıt yok'}
              </Text>
            ))}
          </>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Bugünün öğünleri</Text>
        {!meals.length ? <Text style={styles.hint}>Henüz bir şey eklenmedi.</Text> : null}
        {MEAL_SLOTS.map((sl) => {
          const list = meals.filter((m) => (m.slot ?? 'snack') === sl.id);
          return list.length ? (
            <View key={sl.id} style={{ gap: 4 }}>
              <Text style={styles.slot}>{sl.label}</Text>
              {list.map((m) => (
                <View key={m.id} style={styles.mealRow}>
                  <Text style={[styles.row, { flex: 1 }]}>{hhmm(m.date)} · {m.name} · {m.kcal} kcal</Text>
                  <Pressable onPress={() => { deleteMeal(m.id); bump((n) => n + 1); }} accessibilityLabel={`${m.name} sil`}><Text style={styles.link}>Sil</Text></Pressable>
                </View>
              ))}
            </View>
          ) : null;
        })}
        {meals.length ? (
          <Pressable onPress={discuss} disabled={commenting} style={[styles.ghost, commenting && { opacity: 0.4 }]} accessibilityRole="button">
            <Text style={styles.ghostText}>{commenting ? 'Yorumlanıyor…' : 'Günü yorumla'}</Text>
          </Pressable>
        ) : null}
        {comment ? <Text style={styles.answer} selectable>{comment}</Text> : null}
        {meals.length ? <Text style={styles.hint}>"Günü yorumla" bugünün öğünlerini (ad, kcal, saat) ve kalori sayılarını seçtiğin sağlayıcıya gönderir.</Text> : null}
      </View>

      <Text style={styles.hint}>Ne yediğini yaz, kalorisini tahmin edeyim. Örn. "2 dilim ekmek, 2 yumurta, çay".</Text>
      <TextInput style={[styles.input, { minHeight: 70 }]} value={text} onChangeText={setText} multiline maxLength={500} placeholder="Yediklerin…" placeholderTextColor={colors.muted} accessibilityLabel="Öğün" />
      <Pressable onPress={analyze} disabled={busy || !text.trim()} style={[styles.primary, (busy || !text.trim()) && { opacity: 0.4 }]} accessibilityRole="button">
        <Text style={styles.primaryText}>{busy ? 'Analiz ediliyor…' : 'Analiz et'}</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {items ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tahmin (düzenleyebilirsin)</Text>
          <View style={styles.segs}>
            {MEAL_SLOTS.map((sl) => (
              <Pressable key={sl.id} onPress={() => setSlot(sl.id)} style={[styles.seg, slot === sl.id && styles.segOn]} accessibilityRole="button" accessibilityLabel={`Öğün: ${sl.label}`}>
                <Text style={[styles.segText, slot === sl.id && styles.segTextOn]}>{sl.label}</Text>
              </Pressable>
            ))}
          </View>
          {items.map((it, i) => (
            <View key={i} style={styles.mealRow}>
              <TextInput style={[styles.input, { flex: 1 }]} value={it.name} onChangeText={(v) => setItems(items.map((x, j) => (j === i ? { ...x, name: v } : x)))} accessibilityLabel="Yiyecek adı" />
              <TextInput
                style={[styles.input, { width: 72, textAlign: 'right' }]} keyboardType="number-pad" value={String(it.kcal)} accessibilityLabel="kcal"
                onChangeText={(v) => setItems(items.map((x, j) => (j === i ? { ...x, kcal: Math.max(0, Math.round(Number(v.replace(/\D/g, '')) || 0)) } : x)))}
              />
              <Pressable onPress={() => setItems(items.filter((_, j) => j !== i))} accessibilityLabel="Kaldır"><Text style={styles.link}>✕</Text></Pressable>
            </View>
          ))}
          <Text style={styles.hint}>Toplam {items.reduce((s, x) => s + x.kcal, 0)} kcal · tahmindir · saat şimdi olarak kaydedilir ({slotLabel(slot)})</Text>
          <Pressable onPress={() => { addMeals(items, slot); setItems(null); setText(''); }} style={styles.primary} accessibilityRole="button">
            <Text style={styles.primaryText}>Ekle</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  head: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  segs: { flexDirection: 'row', gap: 8 },
  seg: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  segOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  segText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  segTextOn: { color: colors.accentInk },
  notice: { padding: 12, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.warn, gap: 4 },
  noticeText: { color: colors.text, fontSize: 13 },
  noticeLink: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  content: { padding: 16, gap: 12 },
  hint: { color: colors.muted, fontSize: 13 },
  error: { color: colors.hard, fontSize: 13 },
  link: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  bubble: { maxWidth: '88%', padding: 12, borderRadius: 14 },
  me: { alignSelf: 'flex-end', backgroundColor: colors.accent },
  coach: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  bubbleText: { color: colors.text, fontSize: 16 },
  composer: { flexDirection: 'row', gap: 8, padding: 12, alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: colors.line },
  input: { color: colors.text, fontSize: 16, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line },
  send: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14 },
  sendText: { color: colors.accentInk, fontSize: 13, fontWeight: '700' },
  primary: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: colors.accentInk, fontSize: 16, fontWeight: '700' },
  card: { borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 8 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  row: { color: colors.text, fontSize: 13 },
  big: { color: colors.text, fontSize: 28, fontWeight: '700' },
  slot: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  answer: { color: colors.text, fontSize: 16 },
  ghost: { borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.line },
  ghostText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
