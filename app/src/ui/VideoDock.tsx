// The YouTube player of the workout screen. A pasted link is checked first (does the video exist, may it
// be embedded); problems show a clear message and a way out to the YouTube app.
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';
import { embedVerdict, playerErrorText, watchUrl, type YouTubeLink } from '@/shared';
import { colors } from '@/theme';

async function checkEmbeddable(link: YouTubeLink): Promise<string | null> {
  if (link.kind !== 'video') return 'Oynatma listeleri burada açılmıyor.';
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl(link))}`);
    const verdict = embedVerdict(res.status);
    if (verdict === 'blocked') return playerErrorText(150);
    if (verdict === 'missing') return playerErrorText(100);
  } catch { /* offline or slow: let the player try */ }
  return null;
}

interface Props {
  link: YouTubeLink;
  width: number; // the player is 16:9 at this width
  flat?: boolean; // edge to edge: no rounded corners
  // Draw the player at this fixed width and scale it down to `width`. The page inside the WebView is then
  // never laid out again, so the video follows size changes at once instead of keeping its first size.
  fixedRender?: number;
}

export function VideoDock({ link, width, flat, fixedRender }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    let alive = true;
    setError(null);
    setPlaying(true);
    checkEmbeddable(link).then((e) => { if (alive) setError(e); });
    return () => { alive = false; };
  }, [link]);

  if (error) {
    return (
      <View style={[styles.error, { width }]}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={() => Linking.openURL(watchUrl(link))} accessibilityRole="link">
          <Text style={styles.open}>YouTube’da aç</Text>
        </Pressable>
      </View>
    );
  }
  const renderW = fixedRender ?? width;
  const renderH = (renderW * 9) / 16;
  const player = (
    <YoutubePlayer
      height={renderH}
      width={renderW}
      videoId={link.id}
      play={playing}
      onChangeState={(state: string) => { if (state === 'ended') setPlaying(false); }}
      onError={(code: string) => setError(playerErrorText(code === 'video_not_found' ? 100 : code === 'embed_not_allowed' ? 150 : 0))}
      webViewProps={{ allowsInlineMediaPlayback: true, mediaPlaybackRequiresUserAction: false }}
      initialPlayerParams={{ rel: false, modestbranding: true }}
    />
  );
  return (
    <View style={[styles.player, flat && { borderRadius: 0 }, { width, height: (width * 9) / 16 }]}>
      {fixedRender ? (
        <View style={{ width: renderW, height: renderH, transformOrigin: 'top left', transform: [{ scale: width / renderW }] }}>
          {player}
        </View>
      ) : player}
    </View>
  );
}

const styles = StyleSheet.create({
  player: { borderRadius: 14, overflow: 'hidden', backgroundColor: '#000' },
  error: { padding: 14, borderRadius: 14, gap: 8, backgroundColor: 'rgba(239,77,77,0.18)' },
  errorText: { color: colors.text, fontSize: 14 },
  open: { color: colors.accent, fontWeight: '700', fontSize: 15 },
});
