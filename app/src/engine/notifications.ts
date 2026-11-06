// Schedules the cues as local notifications, so the phone plays them with the screen locked.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { PlannedCue } from './cuePlan';

const SOUNDS = ['up', 'down', 'warn', 'finish'] as const;

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
          sound: `${name}.wav`,
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

export async function cancelCues() {
  try { await Notifications.cancelAllScheduledNotificationsAsync(); } catch { /* none scheduled */ }
}

export async function scheduleCues(cues: PlannedCue[]) {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const cue of cues) {
      await Notifications.scheduleNotificationAsync({
        content: { title: cue.title, body: cue.body, sound: Platform.OS === 'ios' ? `${cue.sound}.wav` : undefined },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(cue.at), channelId: `cue-${cue.sound}` },
      });
    }
  } catch { /* notifications are a bonus: the workout runs without them */ }
}
