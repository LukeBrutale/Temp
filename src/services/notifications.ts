import type { NotificationSettings } from '../types/workout';

export type BrowserNotificationPermission =
  | NotificationPermission
  | 'unsupported';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: false,
  inactivityReminderEnabled: true,
  inactivityDaysThreshold: 2,
  preferredTime: '18:00',
  weightReminderAfterExercise: true,
  lastOpenedAtMs: Date.now(),
};

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): BrowserNotificationPermission {
  if (!isNotificationSupported()) return 'unsupported';
  return window.Notification.permission;
}

export async function requestNotificationPermission(): Promise<BrowserNotificationPermission> {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    const result = await window.Notification.requestPermission();
    return result;
  } catch {
    return window.Notification.permission;
  }
}

export function sendWebNotification(
  title: string,
  body: string,
  tag?: string
): boolean {
  if (!isNotificationSupported()) return false;
  if (window.Notification.permission !== 'granted') return false;

  try {
    const notification = new window.Notification(title, {
      body,
      tag,
    });
    notification.onclick = () => {
      try {
        window.focus();
        notification.close();
      } catch {
        // Ignore window focus restrictions
      }
    };
    return true;
  } catch {
    return false;
  }
}

export function isPreferredTimeReachedToday(
  preferredTime: string,
  now: Date = new Date()
): boolean {
  const [hhRaw, mmRaw] = preferredTime.split(':');
  const hh = Number(hhRaw);
  const mm = Number(mmRaw);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return true;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const targetMinutes = hh * 60 + mm;
  return nowMinutes >= targetMinutes;
}

export function shouldTriggerInactivityReminder(
  settings: NotificationSettings,
  referenceLastOpenedMs: number,
  nowMs: number = Date.now()
): { shouldTrigger: boolean; daysInactive: number } {
  if (!settings.enabled || !settings.inactivityReminderEnabled) {
    return { shouldTrigger: false, daysInactive: 0 };
  }

  const thresholdDays = Math.max(1, settings.inactivityDaysThreshold || 2);
  const msInactive = Math.max(0, nowMs - referenceLastOpenedMs);
  const daysInactive = msInactive / (1000 * 60 * 60 * 24);

  if (daysInactive < thresholdDays) {
    return { shouldTrigger: false, daysInactive };
  }

  // Avoid repeating more than once per 12 hours
  if (
    settings.lastInactivityNotifiedAtMs &&
    nowMs - settings.lastInactivityNotifiedAtMs < 12 * 60 * 60 * 1000
  ) {
    return { shouldTrigger: false, daysInactive };
  }

  return { shouldTrigger: true, daysInactive };
}
