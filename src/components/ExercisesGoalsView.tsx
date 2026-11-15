import React, { useMemo, useRef, useState } from 'react';
import {
  Bell,
  BellOff,
  BellRing,
  Download,
  Monitor,
  Moon,
  Plus,
  RotateCcw,
  Search,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  getNotificationPermission,
  requestNotificationPermission,
  sendWebNotification,
  type BrowserNotificationPermission,
} from '../services/notifications';
import {
  BodyProfile,
  ExerciseDefinition,
  MuscleGroup,
  NotificationSettings,
  ThemeMode,
  WeeklyGoals,
} from '../types/workout';

interface ExercisesGoalsViewProps {
  exercises: ExerciseDefinition[];
  goals: WeeklyGoals;
  bodyProfile: BodyProfile;
  theme: ThemeMode;
  notificationSettings: NotificationSettings;
  onUpdateTheme: (theme: ThemeMode) => void;
  onUpdateNotificationSettings: (settings: NotificationSettings) => void;
  onAddExercise: (ex: Omit<ExerciseDefinition, 'id'>) => void;
  onDeleteCustomExercise: (id: string) => void;
  onUpdateGoals: (goals: WeeklyGoals) => void;
  onUpdateBodyProfile: (profile: BodyProfile) => void;
  onExportJson: () => void;
  onImportJson: (raw: string) => { ok: boolean; message: string };
  onResetDemoData: () => void;
  onNotify?: (msg: string) => void;
}

const MUSCLE_FILTER_OPTIONS: ('Усі' | MuscleGroup)[] = [
  'Усі',
  'Груди',
  'Спина',
  'Ноги',
  'Плечі',
  'Руки',
  'Кор',
  'Кардіо',
  'Мобільність',
];

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

export const ExercisesGoalsView: React.FC<ExercisesGoalsViewProps> = ({
  exercises,
  goals,
  bodyProfile,
  theme,
  notificationSettings,
  onUpdateTheme,
  onUpdateNotificationSettings,
  onAddExercise,
  onDeleteCustomExercise,
  onUpdateGoals,
  onUpdateBodyProfile,
  onExportJson,
  onImportJson,
  onResetDemoData,
  onNotify,
}) => {
  const [muscleFilter, setMuscleFilter] = useState<'Усі' | MuscleGroup>('Усі');
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [newMuscle, setNewMuscle] = useState<MuscleGroup>('Груди');
  const [newTracking, setNewTracking] = useState<'strength' | 'cardio' | 'duration'>(
    'strength'
  );
  const [confirmReset, setConfirmReset] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [notifPermission, setNotifPermission] = useState<BrowserNotificationPermission>(() =>
    getNotificationPermission()
  );
  const [notifFeedback, setNotifFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleEnableNotifications = async () => {
    setNotifFeedback(null);
    const current = getNotificationPermission();
    if (current === 'unsupported') {
      setNotifPermission('unsupported');
      setNotifFeedback('Ваш браузер не підтримує Web Notifications API.');
      return;
    }

    const res = current === 'granted' ? 'granted' : await requestNotificationPermission();
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
      setNotifFeedback('Запит дозволу відхилено. Спробуйте натиснути кнопку ще раз.');
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

  const filteredExercises = useMemo(() => {
    const q = search.trim().toLowerCase();
    return exercises
      .filter((e) => (muscleFilter === 'Усі' ? true : e.muscleGroup === muscleFilter))
      .filter((e) => (!q ? true : e.name.toLowerCase().includes(q)));
  }, [exercises, muscleFilter, search]);

  const handleCreateExercise = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    onAddExercise({
      name: trimmed,
      muscleGroup: newMuscle,
      trackingType: newTracking,
      isCustom: true,
    });
    setNewName('');
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = onImportJson(String(reader.result ?? ''));
      setImportStatus(result.message);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const bmiInfo = useMemo(() => {
    const hMeters = bodyProfile.heightCm / 100;
    if (hMeters <= 0 || bodyProfile.weightKg <= 0) {
      return null;
    }
    const bmi = Math.round((bodyProfile.weightKg / (hMeters * hMeters)) * 10) / 10;
    const minHealthyKg = Math.round(18.5 * hMeters * hMeters * 10) / 10;
    const maxHealthyKg = Math.round(24.9 * hMeters * hMeters * 10) / 10;

    let category = 'Нормальна вага';
    let colorClass = 'text-emerald-700 dark:text-emerald-400';
    if (bmi < 18.5) {
      category = 'Недостатня вага';
      colorClass = 'text-sky-700 dark:text-sky-400';
    } else if (bmi >= 25 && bmi < 30) {
      category = 'Надмірна вага';
      colorClass = 'text-amber-700 dark:text-amber-400';
    } else if (bmi >= 30) {
      category = 'Ожиріння';
      colorClass = 'text-rose-700 dark:text-rose-400';
    }

    // Map BMI [15..35] onto [0..100%] scale marker
    const markerPct = Math.min(98, Math.max(2, ((bmi - 15) / 20) * 100));

    return { bmi, category, colorClass, minHealthyKg, maxHealthyKg, markerPct };
  }, [bodyProfile.heightCm, bodyProfile.weightKg]);

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
                      isSelected ? 'text-orange-400 dark:text-white' : 'text-[var(--text-muted)]'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold leading-tight">
                      {opt.label}
                    </div>
                    <div
                      className={`mt-0.5 text-[11px] leading-snug ${
                        isSelected ? 'text-slate-300 dark:text-orange-100' : 'text-[var(--text-muted)]'
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
              {new Date(notificationSettings.lastOpenedAtMs).toLocaleString('uk-UA', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Body Profile & BMI Calculator */}
      <section
        aria-label="Параметри профілю та ІМТ"
        className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-6"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-4 flex-1">
            <div>
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                Параметри тіла та ІМТ
              </h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Вкажіть поточний зріст і вагу для автоматичного розрахунку індексу маси тіла (BMI).
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
              <div>
                <label
                  htmlFor="profile-height"
                  className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
                >
                  Зріст (см)
                </label>
                <input
                  id="profile-height"
                  type="number"
                  min={100}
                  max={240}
                  step={1}
                  value={bodyProfile.heightCm || ''}
                  onChange={(e) =>
                    onUpdateBodyProfile({
                      ...bodyProfile,
                      heightCm: Math.max(0, Number(e.target.value)),
                    })
                  }
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] font-mono text-base font-semibold tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-orange-600"
                />
              </div>

              <div>
                <label
                  htmlFor="profile-weight"
                  className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
                >
                  Вага (кг)
                </label>
                <input
                  id="profile-weight"
                  type="number"
                  min={30}
                  max={250}
                  step={0.5}
                  value={bodyProfile.weightKg || ''}
                  onChange={(e) =>
                    onUpdateBodyProfile({
                      ...bodyProfile,
                      weightKg: Math.max(0, Number(e.target.value)),
                    })
                  }
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] font-mono text-base font-semibold tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-orange-600"
                />
              </div>
            </div>
          </div>

          <div className="lg:w-96 pt-4 lg:pt-0 lg:pl-6 border-t lg:border-t-0 lg:border-l border-[var(--border-subtle)] space-y-3">
            {bmiInfo ? (
              <>
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <div className="text-xs font-medium text-[var(--text-muted)]">Поточний ІМТ</div>
                    <div className="mt-0.5 text-3xl font-mono font-semibold tabular-nums text-[var(--text-primary)]">
                      {bmiInfo.bmi}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-semibold ${bmiInfo.colorClass}`}>
                      {bmiInfo.category}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] font-mono tabular-nums mt-0.5">
                      Норма: {bmiInfo.minHealthyKg}–{bmiInfo.maxHealthyKg} кг
                    </div>
                  </div>
                </div>

                {/* BMI Visual Range Bar */}
                <div className="space-y-1.5">
                  <div className="relative h-2.5 w-full rounded-full overflow-hidden flex bg-[var(--bg-surface-muted)]">
                    <div className="h-full bg-sky-500" style={{ width: '17.5%' }} />
                    <div className="h-full bg-emerald-500" style={{ width: '32.5%' }} />
                    <div className="h-full bg-amber-500" style={{ width: '25%' }} />
                    <div className="h-full bg-rose-500" style={{ width: '25%' }} />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-slate-900 dark:bg-white border-2 border-white dark:border-slate-900 shadow"
                      style={{ left: `${bmiInfo.markerPct}%` }}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="flex justify-between text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
                    <span>15</span>
                    <span>18.5</span>
                    <span>25</span>
                    <span>30</span>
                    <span>35+</span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">
                Введіть коректні зріст та вагу для розрахунку ІМТ.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Weekly Goals & Data Backup */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-6 space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">
              Персональні цілі
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Налаштуйте тижневі та денні орієнтири для кілець прогресу.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm font-medium mb-1">
                <label htmlFor="goal-workouts" className="text-[var(--text-secondary)]">
                  Тренувань на тиждень
                </label>
                <span className="font-mono tabular-nums text-[var(--text-primary)]">
                  {goals.workoutsPerWeek}
                </span>
              </div>
              <input
                id="goal-workouts"
                type="range"
                min={1}
                max={14}
                value={goals.workoutsPerWeek}
                onChange={(e) =>
                  onUpdateGoals({
                    ...goals,
                    workoutsPerWeek: Number(e.target.value),
                  })
                }
                className="w-full h-10 accent-orange-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-sm font-medium mb-1">
                <label htmlFor="goal-daily-min" className="text-[var(--text-secondary)]">
                  Денна норма активності (хв)
                </label>
                <span className="font-mono tabular-nums text-[var(--text-primary)]">
                  {goals.dailyMinutesTarget} хв
                </span>
              </div>
              <input
                id="goal-daily-min"
                type="range"
                min={15}
                max={120}
                step={5}
                value={goals.dailyMinutesTarget}
                onChange={(e) =>
                  onUpdateGoals({
                    ...goals,
                    dailyMinutesTarget: Number(e.target.value),
                  })
                }
                className="w-full h-10 accent-orange-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-sm font-medium mb-1">
                <label htmlFor="goal-weekly-min" className="text-[var(--text-secondary)]">
                  Тижнева ціль часу (хв)
                </label>
                <span className="font-mono tabular-nums text-[var(--text-primary)]">
                  {goals.minutesPerWeek} хв
                </span>
              </div>
              <input
                id="goal-weekly-min"
                type="range"
                min={60}
                max={600}
                step={15}
                value={goals.minutesPerWeek}
                onChange={(e) =>
                  onUpdateGoals({
                    ...goals,
                    minutesPerWeek: Number(e.target.value),
                  })
                }
                className="w-full h-10 accent-orange-600 cursor-pointer"
              />
            </div>
          </div>
        </section>

        <section className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-6 flex flex-col justify-between gap-5">
          <div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">
              Резервне копіювання даних
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Усі тренування автоматично зберігаються у браузері. Ви можете експортувати журнал у файл JSON або відновити його пізніше.
            </p>
            {importStatus && (
              <p className="mt-3 text-sm font-medium text-orange-700 dark:text-orange-400">{importStatus}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onExportJson}
              className="min-h-[44px] px-4 py-2 text-sm font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              Експорт JSON
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={handleFileImport}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[44px] px-4 py-2 text-sm font-semibold rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-primary)] transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <Upload className="w-4 h-4" />
              Імпорт JSON
            </button>

            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="min-h-[44px] px-4 py-2 text-sm font-medium rounded-xl text-[var(--text-secondary)] hover:text-rose-700 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4" />
                Скинути дані
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onResetDemoData();
                    setConfirmReset(false);
                    setImportStatus('Відновлено початкові дані журналу.');
                  }}
                  className="min-h-[44px] px-3.5 text-xs font-semibold rounded-xl bg-rose-600 text-white hover:bg-rose-700 whitespace-nowrap"
                >
                  Підтвердити скидання
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="min-h-[44px] px-3 text-xs font-medium rounded-xl bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] whitespace-nowrap"
                >
                  Скасувати
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Exercise Catalog */}
      <section className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">
              Довідник вправ ({filteredExercises.length})
            </h2>
            <p className="mt-0.5 text-sm text-[var(--text-muted)]">
              Додавайте власні вправи, які одразу стануть доступними під час запису тренувань.
            </p>
          </div>

          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Пошук вправи..."
              aria-label="Пошук у довіднику вправ"
              className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-orange-600"
            />
          </div>
        </div>

        {/* Add Custom Exercise Form */}
        <form
          onSubmit={handleCreateExercise}
          className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] grid grid-cols-1 sm:grid-cols-4 gap-3"
        >
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Назва нової вправи"
            aria-label="Назва нової вправи"
            className="sm:col-span-2 min-h-[44px] px-3.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-orange-600"
          />
          <select
            value={newMuscle}
            onChange={(e) => setNewMuscle(e.target.value as MuscleGroup)}
            aria-label="Група м'язів"
            className="min-h-[44px] px-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)]"
          >
            {MUSCLE_FILTER_OPTIONS.filter((m) => m !== 'Усі').map((mg) => (
              <option key={mg} value={mg}>
                {mg}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <select
              value={newTracking}
              onChange={(e) =>
                setNewTracking(e.target.value as 'strength' | 'cardio' | 'duration')
              }
              aria-label="Тип вимірювання"
              className="flex-1 min-h-[44px] px-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)]"
            >
              <option value="strength">Вага × повт.</option>
              <option value="cardio">Км × хв</option>
              <option value="duration">Час (сек)</option>
            </select>
            <button
              type="submit"
              className="min-h-[44px] px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              Додати
            </button>
          </div>
        </form>

        {/* Muscle Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {MUSCLE_FILTER_OPTIONS.map((mg) => (
            <button
              key={mg}
              type="button"
              onClick={() => setMuscleFilter(mg)}
              className={`min-h-[40px] px-3.5 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap ${
                muscleFilter === mg
                  ? 'bg-slate-900 dark:bg-orange-600 text-white'
                  : 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {mg}
            </button>
          ))}
        </div>

        {/* Exercise Rows */}
        <div className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
          {filteredExercises.map((ex) => (
            <div
              key={ex.id}
              className="py-3.5 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
                  {ex.name}
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  {ex.muscleGroup}
                  <span aria-hidden="true"> · </span>
                  {ex.trackingType === 'strength'
                    ? 'Силова'
                    : ex.trackingType === 'cardio'
                      ? 'Кардіо'
                      : 'Час'}
                  {ex.isCustom ? ' · Власна вправа' : ''}
                </div>
              </div>

              {ex.isCustom && (
                <button
                  type="button"
                  onClick={() => onDeleteCustomExercise(ex.id)}
                  aria-label={`Видалити вправу ${ex.name}`}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
