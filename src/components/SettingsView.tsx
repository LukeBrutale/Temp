import React, { useState } from 'react';
import {
  Bell,
  BellOff,
  BellRing,
  Monitor,
  Moon,
  Sun,
} from 'lucide-react';
import {
  getNotificationPermission,
  requestNotificationPermission,
  sendWebNotification,
  type BrowserNotificationPermission,
} from '../services/notifications';
import type { NotificationSettings, ThemeMode } from '../types/workout';

interface SettingsViewProps {
  theme: ThemeMode;
  notificationSettings: NotificationSettings;
  onUpdateTheme: (theme: ThemeMode) => void;
  onUpdateNotificationSettings: (settings: NotificationSettings) => void;
  onNotify?: (msg: string) => void;
}

const THEME_OPTIONS: {
  id: ThemeMode;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'light',
    label: 'Світла',
    description: 'Чіткий денний контраст',
    icon: Sun,
  },
  {
    id: 'dark',
    label: 'Темна',
    description: 'Комфортно у темному залі чи ввечері',
    icon: Moon,
  },
  {
    id: 'system',
    label: 'Системна',
    description: 'Синхронізація з темою пристрою',
    icon: Monitor,
  },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  theme,
  notificationSettings,
  onUpdateTheme,
  onUpdateNotificationSettings,
  onNotify,
}) => {
  const [notifPermission, setNotifPermission] =
    useState<BrowserNotificationPermission>(() => getNotificationPermission());
  const [notifFeedback, setNotifFeedback] = useState<string | null>(null);

  const handleEnableNotifications = async () => {
    setNotifFeedback(null);
    const current = getNotificationPermission();
    if (current === 'unsupported') {
      setNotifPermission('unsupported');
      setNotifFeedback('Ваш браузер не підтримує Web Notifications API.');
      return;
    }

    const res =
      current === 'granted' ? 'granted' : await requestNotificationPermission();
    setNotifPermission(res);

    if (res === 'granted') {
      onUpdateNotificationSettings({
        ...notificationSettings,
        enabled: true,
      });
      sendWebNotification(
        'Сповіщення «Темп» активовано',
        `Нагадування о ${notificationSettings.preferredTime} при перерві понад ${notificationSettings.inactivityDaysThreshold} дн. та після силових вправ.`,
        'temp-notif-enabled'
      );
      onNotify?.('Push-сповіщення увімкнено');
    } else if (res === 'denied') {
      onUpdateNotificationSettings({
        ...notificationSettings,
        enabled: false,
      });
      setNotifFeedback(
        'Доступ до сповіщень заблоковано в браузері. Дозвольте їх у налаштуваннях сайту, але автонагадування про ваги в активній сесії все одно працюватимуть усередині додатка.'
      );
    } else {
      setNotifFeedback(
        'Запит дозволу відхилено. Спробуйте натиснути кнопку ще раз.'
      );
    }
  };

  const handleSendTestNotification = () => {
    setNotifFeedback(null);
    const perm = getNotificationPermission();
    setNotifPermission(perm);

    if (perm !== 'granted') {
      setNotifFeedback('Спочатку надайте дозвіл на сповіщення в браузері.');
      return;
    }

    const sent = sendWebNotification(
      'Час тренування у «Темп»',
      `Запланований час: ${notificationSettings.preferredTime}. Не забудьте заповнити ваги після завершення кожної вправи!`,
      'temp-notif-test'
    );
    if (sent) {
      onNotify?.('Тестове push-сповіщення надіслано');
    } else {
      setNotifFeedback(
        'Браузер обмежив системне спливаюче вікно у поточному середовищі (вбудований режим), але внутрішні нагадування працюють.'
      );
    }
  };

  return (
    <div className="space-y-8">
      {/* Theme Appearance Settings */}
      <section
        aria-label="Тема оформлення додатка"
        className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-6"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">
              Тема оформлення
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Перемикайте світлу та темну палітру інтерфейсу або використовуйте налаштування системи.
            </p>
          </div>

          <div
            role="radiogroup"
            aria-label="Вибір теми оформлення"
            className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 lg:w-[520px] shrink-0"
          >
            {THEME_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isSelected = theme === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => onUpdateTheme(opt.id)}
                  className={`min-h-[56px] px-3.5 py-2.5 rounded-xl border text-left transition-colors flex items-start gap-2.5 ${
                    isSelected
                      ? 'bg-slate-900 dark:bg-orange-600 text-white border-slate-900 dark:border-orange-500'
                      : 'bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      isSelected
                        ? 'text-orange-400 dark:text-white'
                        : 'text-[var(--text-muted)]'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold leading-tight">
                      {opt.label}
                    </div>
                    <div
                      className={`mt-0.5 text-[11px] leading-snug ${
                        isSelected
                          ? 'text-slate-300 dark:text-orange-100'
                          : 'text-[var(--text-muted)]'
                      }`}
                    >
                      {opt.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Push Notifications & Reminders Settings */}
      <section
        aria-label="Налаштування push-сповіщень"
        className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-6 space-y-5"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-orange-600 dark:text-orange-400 shrink-0" />
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                Push-сповіщення та нагадування
              </h2>
            </div>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Налаштуйте системні сповіщення через Notifications API про час тренування після перерви та автоматичне нагадування заповнити ваги після вправ.
            </p>
            <div className="mt-2 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  notifPermission === 'granted' && notificationSettings.enabled
                    ? 'bg-emerald-500'
                    : notifPermission === 'denied'
                      ? 'bg-rose-500'
                      : 'bg-amber-500'
                }`}
              />
              <span>
                {notifPermission === 'unsupported'
                  ? 'Notifications API не підтримується цим браузером'
                  : notifPermission === 'denied'
                    ? 'Доступ заблоковано в налаштуваннях браузера'
                    : notifPermission === 'granted'
                      ? notificationSettings.enabled
                        ? 'Системні сповіщення дозволено та активні'
                        : 'Дозвіл у браузері надано, сповіщення вимкнені'
                      : 'Дозвіл у браузері ще не надано'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {notifPermission === 'granted' && notificationSettings.enabled ? (
              <>
                <button
                  type="button"
                  onClick={handleSendTestNotification}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface-subtle)] hover:bg-[var(--bg-surface-muted)] text-xs font-semibold text-[var(--text-primary)] inline-flex items-center gap-2 transition-colors"
                >
                  <BellRing className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  Перевірити сповіщення
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateNotificationSettings({
                      ...notificationSettings,
                      enabled: false,
                    });
                    onNotify?.('Push-сповіщення вимкнено');
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-muted)] text-xs font-semibold text-[var(--text-secondary)] inline-flex items-center gap-2 transition-colors"
                >
                  <BellOff className="w-4 h-4" />
                  Вимкнути
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={notifPermission === 'unsupported'}
                onClick={() => void handleEnableNotifications()}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
              >
                <Bell className="w-4 h-4" />
                Увімкнути push-сповіщення
              </button>
            )}
          </div>
        </div>

        {notifFeedback && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300">
            {notifFeedback}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 border-t border-[var(--border-subtle)]">
          {/* Inactivity > 2 days & preferred time */}
          <div className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">
                  Нагадування при перерві
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Сповіщати про час тренування, якщо додаток не відкривався понад вказану кількість днів.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={notificationSettings.inactivityReminderEnabled}
                aria-label="Увімкнути нагадування при перерві"
                onClick={() =>
                  onUpdateNotificationSettings({
                    ...notificationSettings,
                    inactivityReminderEnabled:
                      !notificationSettings.inactivityReminderEnabled,
                  })
                }
                className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${
                  notificationSettings.inactivityReminderEnabled
                    ? 'bg-orange-600'
                    : 'bg-[var(--border-strong)]'
                }`}
              >
                <span
                  className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    notificationSettings.inactivityReminderEnabled
                      ? 'translate-x-6'
                      : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="notif-inactivity-days"
                  className="block text-xs font-semibold text-[var(--text-secondary)] mb-1"
                >
                  Поріг (днів без візиту)
                </label>
                <select
                  id="notif-inactivity-days"
                  value={notificationSettings.inactivityDaysThreshold}
                  onChange={(e) =>
                    onUpdateNotificationSettings({
                      ...notificationSettings,
                      inactivityDaysThreshold: Number(e.target.value),
                    })
                  }
                  className="w-full min-h-[40px] px-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] font-mono text-sm font-semibold text-[var(--text-primary)] focus:outline-none focus:border-orange-600"
                >
                  <option value={1}>1 день</option>
                  <option value={2}>2 дні</option>
                  <option value={3}>3 дні</option>
                  <option value={5}>5 днів</option>
                  <option value={7}>7 днів</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="notif-preferred-time"
                  className="block text-xs font-semibold text-[var(--text-secondary)] mb-1"
                >
                  Час тренування
                </label>
                <input
                  id="notif-preferred-time"
                  type="time"
                  value={notificationSettings.preferredTime}
                  onChange={(e) =>
                    onUpdateNotificationSettings({
                      ...notificationSettings,
                      preferredTime: e.target.value || '18:00',
                    })
                  }
                  className="w-full min-h-[40px] px-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] font-mono text-sm font-semibold text-[var(--text-primary)] focus:outline-none focus:border-orange-600"
                />
              </div>
            </div>
          </div>

          {/* Weight reminder after completing an exercise */}
          <div className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex flex-col justify-between gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">
                  Нагадування заповнити ваги після вправи
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Автоматично нагадувати (push-сповіщенням та підсвіткою в активній сесії), якщо після завершення всіх підходів силової вправи вага не була оновлена або дорівнює 0 кг.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={notificationSettings.weightReminderAfterExercise}
                aria-label="Увімкнути нагадування заповнити ваги після вправи"
                onClick={() =>
                  onUpdateNotificationSettings({
                    ...notificationSettings,
                    weightReminderAfterExercise:
                      !notificationSettings.weightReminderAfterExercise,
                  })
                }
                className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${
                  notificationSettings.weightReminderAfterExercise
                    ? 'bg-orange-600'
                    : 'bg-[var(--border-strong)]'
                }`}
              >
                <span
                  className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    notificationSettings.weightReminderAfterExercise
                      ? 'translate-x-6'
                      : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="text-xs text-[var(--text-muted)] font-mono tabular-nums">
              Остання активність у додатку:{' '}
              {new Date(notificationSettings.lastOpenedAtMs).toLocaleString(
                'uk-UA',
                {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                }
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
