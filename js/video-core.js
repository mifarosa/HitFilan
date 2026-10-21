// Pure helpers for the video dock: parsing YouTube links and mapping player errors.

// Returns { kind: 'video' | 'playlist', id } or null for anything that is not a YouTube link.
export function parseYouTube(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, '');
  const idOk = (s) => /^[\w-]{11}$/.test(s || '');
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    return idOk(id) ? { kind: 'video', id } : null;
  }
  if (host !== 'youtube.com' && host !== 'youtube-nocookie.com') return null;
  const v = url.searchParams.get('v');
  if (idOk(v)) return { kind: 'video', id: v };
  const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/);
  if (m) return { kind: 'video', id: m[1] };
  const list = url.searchParams.get('list');
  if (list && /^[\w-]{10,}$/.test(list)) return { kind: 'playlist', id: list };
  return null;
}

export const watchUrl = (v) => (v.kind === 'playlist'
  ? `https://www.youtube.com/playlist?list=${v.id}`
  : `https://www.youtube.com/watch?v=${v.id}`);

export const thumbUrl = (v) => (v.kind === 'video' ? `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg` : '');

// YouTube IFrame API error codes -> Turkish explanation.
export function playerErrorText(code) {
  if (code === 101 || code === 150) return 'Video sahibi bu videonun burada oynatılmasına izin vermemiş.';
  if (code === 100) return 'Video bulunamadı ya da gizli.';
  if (code === 2) return 'Bağlantı geçersiz.';
  return 'Video oynatılamadı.';
}

// Result of YouTube's oEmbed check for a pasted link (HTTP status -> verdict).
export function embedVerdict(status) {
  if (status === 200) return 'ok';
  if (status === 401 || status === 403) return 'blocked'; // embedding disabled
  if (status === 404) return 'missing';
  return 'unknown';
}
