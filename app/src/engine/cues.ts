// Plays cues while the app is on screen: short beeps that mix over other apps' music, optional Turkish
// speech, and vibration.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { Platform, Vibration } from 'react-native';
import type { Beep, Cue } from './cueLogic';

const SOURCES: Record<Beep, number> = {
  tick: require('../../assets/sounds/tick.wav'),
  count: require('../../assets/sounds/count.wav'),
  warn: require('../../assets/sounds/warn.wav'),
  up: require('../../assets/sounds/up.wav'),
  down: require('../../assets/sounds/down.wav'),
  finish: require('../../assets/sounds/finish.wav'),
};

const players: Partial<Record<Beep, AudioPlayer>> = {};

export async function initAudio() {
  try {
    // Mix with music from other apps instead of pausing it; play even with the ring switch on silent.
    await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false });
  } catch { /* audio unavailable: cues stay silent */ }
}

export function beep(name: Beep) {
  try {
    const player = (players[name] ??= createAudioPlayer(SOURCES[name]));
    player.seekTo(0);
    player.play();
  } catch { /* audio unavailable */ }
}

export function speak(text: string) {
  try {
    Speech.stop();
    Speech.speak(text, { language: 'tr-TR', rate: 1.05 });
  } catch { /* speech unavailable */ }
}

export function vibrate(pattern: number[]) {
  try {
    if (Platform.OS === 'android') Vibration.vibrate([0, ...pattern]);
    else Haptics.notificationAsync(pattern.length >= 3 ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success);
  } catch { /* no vibration motor */ }
}

export function stopSpeech() {
  try { Speech.stop(); } catch { /* nothing to stop */ }
}

export function play(cue: Cue, muted: boolean) {
  if (cue.vibrate) vibrate(cue.vibrate);
  if (muted) return;
  if (cue.beep) beep(cue.beep);
  if (cue.speech) speak(cue.speech);
}
