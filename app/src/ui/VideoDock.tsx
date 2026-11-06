// The YouTube player of the workout screen. A pasted link is checked first (does the video exist, may it
// be embedded); problems show a clear message and a way out to the YouTube app.
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import YoutubePlayer, { type YoutubeIframeRef } from 'react-native-youtube-iframe';
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
}

export function VideoDock({ link, width, flat }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(true);
  const player = useRef<YoutubeIframeRef>(null);
  // The page inside the WebView keeps the size it was created with, so a new width means a new player:
  // it is built again at the new size and starts where the old one was.
  const [built, setBuilt] = useState({ width, start: 0 });

  useEffect(() => {
    let alive = true;
    setError(null);
    setPlaying(true);
    checkEmbeddable(link).then((e) => { if (alive) setError(e); });
    return () => { alive = false; };
  }, [link]);

  useEffect(() => {
    if (Math.round(width) === Math.round(built.width)) return;
    let alive = true;
    (async () => {
      let at = 0;
      try { at = (await player.current?.getCurrentTime()) ?? 0; } catch { /* not ready: start over */ }
      if (alive) setBuilt({ width, start: Math.max(0, Math.floor(at)) });
    })();
    return () => { alive = false; };
  }, [width, built.width]);

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
  return (
    <View style={[styles.player, flat && { borderRadius: 0 }, { width, height: (width * 9) / 16 }]}>
      <YoutubePlayer
        key={Math.round(built.width)}
        ref={player}
        height={(built.width * 9) / 16}
        width={built.width}
        videoId={link.id}
        play={playing}
        onChangeState={(state: string) => { if (state === 'ended') setPlaying(false); }}
        onError={(code: string) => setError(playerErrorText(code === 'video_not_found' ? 100 : code === 'embed_not_allowed' ? 150 : 0))}
        webViewProps={{ allowsInlineMediaPlayback: true, mediaPlaybackRequiresUserAction: false }}
        // No YouTube full screen button: it covers the app, and our own info with it. The 4th size does the job.
        initialPlayerParams={{ rel: false, modestbranding: true, preventFullScreen: true, start: built.start }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  player: { borderRadius: 14, overflow: 'hidden', backgroundColor: '#000' },
  error: { padding: 14, borderRadius: 14, gap: 8, backgroundColor: 'rgba(239,77,77,0.18)' },
  errorText: { color: colors.text, fontSize: 14 },
  open: { color: colors.accent, fontWeight: '700', fontSize: 15 },
});
