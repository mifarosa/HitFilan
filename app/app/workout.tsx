import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert, Modal, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWorkout, type WorkoutView } from '@/engine/useWorkout';
import { LEVELS, formatTime, loadSettings, parseYouTube, type YouTubeLink } from '@/shared';
import { colors, levelColor } from '@/theme';
import { Controls } from '@/ui/Controls';
import { Ring } from '@/ui/Ring';
import { SquareCard } from '@/ui/SquareCard';
import { Totals } from '@/ui/Totals';
import { VideoDock } from '@/ui/VideoDock';

const clockNow = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function Workout() {
  const { id, bike } = useLocalSearchParams<{ id: string; bike?: string }>();
  const router = useRouter();
  const w = useWorkout(String(id), String(bike ?? 'bike40'));
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [link, setLink] = useState<YouTubeLink | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [clock, setClock] = useState(clockNow());

  useEffect(() => {
    const t = setInterval(() => setClock(clockNow()), 5000);
    return () => clearInterval(t);
  }, []);

  const view = w.view;
  if (!view) return <View style={styles.screen} />;

  const leave = () => router.back();
  const confirmEnd = () =>
    Alert.alert('Antrenmanı bitir?', 'Şu ana kadarki ilerleme geçmişe kaydedilir (1 dakikadan uzunsa).', [
      { text: 'Devam et', style: 'cancel' },
      { text: 'Bitir', style: 'destructive', onPress: leave },
    ]);

  const landscape = width > height;
  const fullBleed = !!link; // with a video the page is used edge to edge; the pieces add their own margins
  const pad = {
    paddingTop: insets.top + 6,
    paddingBottom: insets.bottom + 8,
    paddingLeft: fullBleed ? (landscape ? insets.left : 0) : insets.left + 16,
    paddingRight: fullBleed ? (landscape ? insets.right : 0) : insets.right + 16,
  };
  const color = levelColor(view.step.level);

  const pills = (compact: boolean) => (
    <>
      <Pressable style={[styles.pill, compact && styles.pillSmall]} onPress={confirmEnd}><Text style={styles.pillText}>✕ Bitir</Text></Pressable>
      {compact ? <View style={{ flex: 1 }} /> : <Text style={styles.title} numberOfLines={1}>{view.name}</Text>}
      <Pressable style={[styles.pill, compact && styles.pillSmall]} onPress={w.toggleMute}><Text style={styles.pillText}>{w.muted ? '🔇' : '🔊'}</Text></Pressable>
      {link
        ? <Pressable style={[styles.pill, compact && styles.pillSmall]} onPress={() => setLink(null)}><Text style={styles.pillText}>{compact ? 'Kapat' : 'Videoyu kapat'}</Text></Pressable>
        : <Pressable style={styles.pill} onPress={() => setPasteOpen(true)}><Text style={styles.pillText}>Video</Text></Pressable>}
    </>
  );
  const topBar = <View style={[styles.topBar, fullBleed && !landscape && { paddingHorizontal: 16 }]}>{pills(false)}</View>;

  const controls = (small: boolean) => (
    <Controls running={view.running} open={view.step.open === true} small={small} onPrev={w.prev} onToggle={w.toggle} onNext={w.next} />
  );
  const time = view.step.open ? `${view.step.reps}×` : formatTime(view.remaining);

  let body: React.ReactNode;
  if (link && landscape) {
    // Video on the left, edge to edge and as tall as the screen allows (16:9); on the right the actions,
    // the card that fills the rest, the totals and the buttons.
    const availH = height - insets.top - insets.bottom - 12;
    const availW = width - insets.left - insets.right;
    const videoW = Math.max(180, Math.min(availH * (16 / 9), availW - 240));
    body = (
      <View style={styles.landFull}>
        <View style={[styles.videoCol, { width: videoW }]}><VideoDock link={link} width={videoW} flat /></View>
        <View style={styles.rightCol}>
          <View style={styles.actionsRow}>{pills(true)}</View>
          <SquareCard view={view} />
          <Totals view={view} clock={clock} />
          {controls(true)}
        </View>
      </View>
    );
  } else if (link) {
    body = (
      <>
        <VideoDock link={link} width={width} flat />
        <View style={styles.cardWrap}><SquareCard view={view} /></View>
        <View style={styles.totalsWrap}><Totals view={view} clock={clock} /></View>
        {controls(false)}
      </>
    );
  } else if (landscape) {
    body = (
      <View style={styles.landRow}>
        <Ring size={Math.min(height - pad.paddingTop - pad.paddingBottom - 70, 230)} progress={view.progress} color={color} time={time} warn={view.warn} />
        <View style={{ flex: 1, gap: 12 }}>
          <StepInfo view={view} color={color} compact />
          <Totals view={view} clock={clock} />
        </View>
        {controls(false)}
      </View>
    );
  } else {
    body = (
      <>
        <View style={styles.centerCol}>
          <Ring size={Math.min(250, width - 96)} progress={view.progress} color={color} time={time} warn={view.warn} />
          <StepInfo view={view} color={color} />
        </View>
        <Totals view={view} clock={clock} />
        <View style={{ height: 14 }} />
        {controls(false)}
      </>
    );
  }

  return (
    <View style={[styles.screen, pad]}>
      {!(link && landscape) && topBar}
      <View style={styles.body}>{body}</View>

      {view.finished && (
        <View style={styles.finish}>
          <Text style={styles.finishTitle}>Tamamlandı</Text>
          <Text style={styles.finishText}>{view.name}</Text>
          <Text style={styles.finishMeta}>{formatTime(view.elapsed)} · ~{view.kcal} kcal</Text>
          <Pressable style={[styles.pill, { marginTop: 18 }]} onPress={leave}><Text style={styles.pillText}>Tamam</Text></Pressable>
        </View>
      )}

      <PasteDialog
        visible={pasteOpen} onClose={() => setPasteOpen(false)}
        onSubmit={(text) => { const l = parseYouTube(text); if (l) { setLink(l); setPasteOpen(false); } return !!l; }}
      />
    </View>
  );
}

/** Step name, tag, resistance and cadence for bike steps, the tip and what comes next. */
function StepInfo({ view, color, compact }: { view: WorkoutView; color: string; compact?: boolean }) {
  const s = loadSettings();
  const step = view.step;
  const res = step.level === 'easy' ? s.resEasy : step.level === 'moderate' ? s.resModerate : step.level === 'hard' ? s.resHard : null;
  const rpm = LEVELS[step.level]?.rpm;
  return (
    <View style={{ gap: 4, alignItems: compact ? 'flex-start' : 'center' }}>
      <Text style={[styles.tag, { color }]}>{step.tag.toUpperCase()}</Text>
      <Text style={[styles.stepName, compact && { fontSize: 24 }]}>{step.label}</Text>
      {res != null && rpm ? <Text style={styles.target}>Direnç {res} · {rpm} rpm</Text> : null}
      {!compact && step.hint ? <Text style={styles.hint}>{step.hint}</Text> : null}
      {view.next ? (
        <Text style={styles.next}>
          Sıradaki: {view.next.label} · {view.next.open ? `${view.next.reps} tekrar` : formatTime(view.next.dur)}
        </Text>
      ) : null}
    </View>
  );
}

function PasteDialog({ visible, onClose, onSubmit }: { visible: boolean; onClose: () => void; onSubmit: (text: string) => boolean }) {
  const [text, setText] = useState('');
  const [bad, setBad] = useState(false);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBack}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Video ekle</Text>
          <Text style={styles.hint}>Bir YouTube bağlantısı yapıştır. Video, antrenman ekranında oynar.</Text>
          <TextInput
            value={text} onChangeText={(t) => { setText(t); setBad(false); }} placeholder="YouTube bağlantısı"
            placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.modalInput}
          />
          {bad ? <Text style={{ color: colors.hard }}>Bu bir YouTube bağlantısı değil.</Text> : null}
          <View style={styles.modalActions}>
            <Pressable style={styles.pill} onPress={onClose}><Text style={styles.pillText}>Vazgeç</Text></Pressable>
            <Pressable style={[styles.pill, { backgroundColor: colors.accent }]} onPress={() => setBad(!onSubmit(text))}>
              <Text style={[styles.pillText, { color: colors.accentInk }]}>Aç</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 6 },
  title: { flex: 1, color: colors.text, fontWeight: '600', textAlign: 'center' },
  pill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, backgroundColor: colors.surface2 },
  pillSmall: { paddingHorizontal: 11, paddingVertical: 8 },
  pillText: { color: colors.text, fontWeight: '600', fontSize: 14 },
  body: { flex: 1, justifyContent: 'space-between', paddingTop: 6 },
  landFull: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  videoCol: { justifyContent: 'center' },
  rightCol: { flex: 1, gap: 8, paddingRight: 16, justifyContent: 'center' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardWrap: { flex: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 },
  totalsWrap: { paddingHorizontal: 16, paddingBottom: 10 },
  landRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  side: { alignItems: 'center', justifyContent: 'center', gap: 6 },
  sideLabel: { color: colors.text, fontWeight: '700', fontSize: 14, maxWidth: '100%' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  rowFill: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  half: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  centerCol: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  tag: { fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  stepName: { color: colors.text, fontSize: 30, fontWeight: '800', textAlign: 'center' },
  target: { color: colors.text, fontSize: 15, fontWeight: '600' },
  hint: { color: colors.muted, fontSize: 14, textAlign: 'center' },
  next: { color: colors.muted, fontSize: 13, marginTop: 4 },
  finish: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(16,20,24,0.96)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  finishTitle: { color: colors.easy, fontSize: 32, fontWeight: '800' },
  finishText: { color: colors.text, fontSize: 18, marginTop: 8 },
  finishMeta: { color: colors.muted, fontSize: 16, marginTop: 2 },
  modalBack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modal: { width: '100%', maxWidth: 420, gap: 10, padding: 18, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  modalInput: { color: colors.text, padding: 12, borderRadius: 12, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
});
