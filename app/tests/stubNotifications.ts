// A tiny in-memory stand-in for expo-notifications. Every call takes a little time, like the native side.
export const state = { scheduled: new Set<string>(), next: 1 };
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export const SchedulableTriggerInputTypes = { DATE: 'date' };
export const AndroidImportance = { HIGH: 4 };
export const setNotificationHandler = () => {};
export const setNotificationChannelAsync = async () => {};
export const getPermissionsAsync = async () => ({ granted: true });
export const requestPermissionsAsync = async () => ({ granted: true });
export const cancelAllScheduledNotificationsAsync = async () => {
  await tick();
  state.scheduled.clear();
};
export const scheduleNotificationAsync = async () => {
  await tick();
  const id = `n${state.next++}`;
  state.scheduled.add(id);
  return id;
};
