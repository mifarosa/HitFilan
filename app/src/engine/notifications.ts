// Schedules the cues as local notifications, so the phone plays them with the screen locked.
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { PlannedCue } from './cuePlan';

const SOUNDS = ['up', 'down', 'warn', 'finish'] as const;

// Expo Go has no custom notification sounds (they are bundled by the config plugin into a real build),
// and asking for one logs an error per sound. There the notifications use the phone's default sound.
const CUSTOM_SOUNDS = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

export async function setupNotifications(): Promise<boolean> {
  try {
    // On screen the app plays its own cues: the notification is only for when the app is not showing.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: false, shouldShowList: false,
      }),
    });
    if (Platform.OS === 'android') {
      for (const name of SOUNDS) {
        await Notifications.setNotificationChannelAsync(`cue-${name}`, {
          name: `Antrenman uyarısı (${name})`,
          importance: Notifications.AndroidImportance.HIGH,
          sound: CUSTOM_SOUNDS ? `${name}.wav` : 'default',
          vibrationPattern: [0, 200, 100, 200],
        });
      }
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

// Every change goes through one queue, so a cancel can never overlap with a schedule that is still adding
// notifications (that overlap left old cues behind after pause, skip or close). A newer call also makes an
// older, unfinished schedule stop adding at once.
let queue: Promise<void> = Promise.resolve();
let generation = 0;

function enqueue(job: () => Promise<void>): Promise<void> {
  queue = queue.then(job, job);
  return queue;
}

async function cancelAll() {
  try { await Notifications.cancelAllScheduledNotificationsAsync(); } catch { /* none scheduled */ }
}

export function cancelCues(): Promise<void> {
  generation += 1;
  return enqueue(cancelAll);
}

export function scheduleCues(cues: PlannedCue[]): Promise<void> {
  const mine = ++generation;
  return enqueue(async () => {
    await cancelAll();
    for (const cue of cues) {
      if (mine !== generation) return; // a newer plan (or a cancel) took over
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: cue.title,
            body: cue.body,
            sound: Platform.OS === 'ios' ? (CUSTOM_SOUNDS ? `${cue.sound}.wav` : 'default') : undefined,
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(cue.at), channelId: `cue-${cue.sound}` },
        });
      } catch { /* notifications are a bonus: the workout runs without them */ }
    }
  });
}
