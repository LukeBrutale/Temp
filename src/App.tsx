import React, { useEffect, useMemo, useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  BarChart3,
  CalendarCheck,
  Dumbbell,
  ListChecks,
  Moon,
  Plus,
  Settings,
  Sun,
  User,
} from 'lucide-react';
import { AiPlanGeneratorModal } from './components/AiPlanGeneratorModal';
import { ExercisesGoalsView } from './components/ExercisesGoalsView';
import { LiveSessionBanner } from './components/LiveSessionBanner';
import { ProfileView } from './components/ProfileView';
import { ProgressView } from './components/ProgressView';
import { SettingsView } from './components/SettingsView';
import { TodayView } from './components/TodayView';
import { WorkoutModal } from './components/WorkoutModal';
import { WorkoutsView } from './components/WorkoutsView';
import {
  DEFAULT_BODY_PROFILE,
  DEFAULT_GOALS,
  INITIAL_EXERCISES,
  WORKOUT_TEMPLATES,
  createInitialPrograms,
  createSeedWorkouts,
} from './data/initialData';
import {
  detectDefaultDeviceName,
  getAccessToken,
  getUserInitials,
  googleSignIn,
  initAuth,
  logout as googleLogout,
} from './services/googleDriveSync';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  isPreferredTimeReachedToday,
  sendWebNotification,
  shouldTriggerInactivityReminder,
} from './services/notifications';
import {
  ActiveSessionState,
  BodyProfile,
  CloudBackupPayload,
  ExerciseDefinition,
  NotificationSettings,
  ThemeMode,
  TrainingProgram,
  UserProfile,
  WeeklyGoals,
  WorkoutSession,
  WorkoutTemplate,
} from './types/workout';
import {
  calculateStreakDays,
  getScheduledProgramDay,
  getWeekStartMonday,
  toLocalDateString,
} from './utils/workoutStats';

type NavTab = 'today' | 'workouts' | 'progress' | 'exercises' | 'profile' | 'settings';

const STORAGE_KEYS = {
  sessions: 'temp_workouts_v1',
  exercises: 'temp_exercises_v1',
  goals: 'temp_goals_v1',
  bodyProfile: 'temp_body_profile_v1',
  programs: 'temp_programs_v1',
  customTemplates: 'temp_custom_templates_v1',
  active: 'temp_active_session_v1',
  theme: 'temp_theme_v1',
  userProfile: 'temp_user_profile_v1',
  notificationSettings: 'temp_notification_settings_v1',
};

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  const todayDate = useMemo(() => toLocalDateString(new Date()), []);

  const [activeTab, setActiveTab] = useState<NavTab>('today');
  const [selectedDate, setSelectedDate] = useState<string>(todayDate);

  const [sessions, setSessions] = useState<WorkoutSession[]>(() =>
    readStorage<WorkoutSession[]>(STORAGE_KEYS.sessions, createSeedWorkouts(todayDate))
  );
  const [exercises, setExercises] = useState<ExerciseDefinition[]>(() =>
    readStorage<ExerciseDefinition[]>(STORAGE_KEYS.exercises, INITIAL_EXERCISES)
  );
  const [goals, setGoals] = useState<WeeklyGoals>(() =>
    readStorage<WeeklyGoals>(STORAGE_KEYS.goals, DEFAULT_GOALS)
  );
  const [bodyProfile, setBodyProfile] = useState<BodyProfile>(() =>
    readStorage<BodyProfile>(STORAGE_KEYS.bodyProfile, DEFAULT_BODY_PROFILE)
  );
  const [programs, setPrograms] = useState<TrainingProgram[]>(() =>
    readStorage<TrainingProgram[]>(
      STORAGE_KEYS.programs,
      createInitialPrograms(todayDate)
    )
  );
  const [customTemplates, setCustomTemplates] = useState<WorkoutTemplate[]>(() =>
    readStorage<WorkoutTemplate[]>(STORAGE_KEYS.customTemplates, [])
  );
  const [activeLive, setActiveLive] = useState<ActiveSessionState | null>(() =>
    readStorage<ActiveSessionState | null>(STORAGE_KEYS.active, null)
  );
  const [theme, setTheme] = useState<ThemeMode>(() =>
    readStorage<ThemeMode>(STORAGE_KEYS.theme, 'light')
  );
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
  );

  const [userProfile, setUserProfile] = useState<UserProfile>(() =>
    readStorage<UserProfile>(STORAGE_KEYS.userProfile, {
      name: '',
      bio: '',
      deviceName: detectDefaultDeviceName(),
      updatedAt: new Date().toISOString(),
    })
  );

  const initialNotifCheck = useMemo(() => {
    const stored = readStorage<NotificationSettings>(
      STORAGE_KEYS.notificationSettings,
      DEFAULT_NOTIFICATION_SETTINGS
    );
    return {
      stored: { ...DEFAULT_NOTIFICATION_SETTINGS, ...stored },
      previousLastOpenedAtMs: stored.lastOpenedAtMs ?? Date.now(),
    };
  }, []);

  const [notificationSettings, setNotificationSettings] =
    useState<NotificationSettings>(() => ({
      ...initialNotifCheck.stored,
      lastOpenedAtMs: Date.now(),
    }));

  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [driveAccessToken, setDriveAccessToken] = useState<string | null>(() =>
    getAccessToken()
  );
  const [isSigningIn, setIsSigningIn] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<WorkoutSession | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(sessions));
    } catch {
      // Ignore storage quota errors
    }
  }, [sessions]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.exercises, JSON.stringify(exercises));
    } catch {
      // Ignore storage quota errors
    }
  }, [exercises]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.goals, JSON.stringify(goals));
    } catch {
      // Ignore storage quota errors
    }
  }, [goals]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEYS.bodyProfile,
        JSON.stringify(bodyProfile)
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [bodyProfile]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.programs, JSON.stringify(programs));
    } catch {
      // Ignore storage quota errors
    }
  }, [programs]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEYS.customTemplates,
        JSON.stringify(customTemplates)
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [customTemplates]);

  useEffect(() => {
    try {
      if (activeLive) {
        window.localStorage.setItem(STORAGE_KEYS.active, JSON.stringify(activeLive));
      } else {
        window.localStorage.removeItem(STORAGE_KEYS.active);
      }
    } catch {
      // Ignore storage quota errors
    }
  }, [activeLive]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };
    setSystemPrefersDark(mq.matches);
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  const isDarkActive = theme === 'dark' || (theme === 'system' && systemPrefersDark);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkActive);
    try {
      window.localStorage.setItem(STORAGE_KEYS.theme, JSON.stringify(theme));
    } catch {
      // Ignore storage quota errors
    }
  }, [theme, isDarkActive]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEYS.userProfile,
        JSON.stringify(userProfile)
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [userProfile]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEYS.notificationSettings,
        JSON.stringify(notificationSettings)
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [notificationSettings]);

  useEffect(() => {
    const checkInactivityAndNotify = () => {
      const { shouldTrigger, daysInactive } = shouldTriggerInactivityReminder(
        notificationSettings,
        initialNotifCheck.previousLastOpenedAtMs
      );
      if (!shouldTrigger) return;
      if (!isPreferredTimeReachedToday(notificationSettings.preferredTime)) return;

      const roundedDays = Math.max(1, Math.floor(daysInactive));
      const title = 'Час повернутися до тренувань';
      const body = `Ви не заходили у «Темп» вже ${roundedDays} дн. (цільовий час ${notificationSettings.preferredTime}). Заплануйте коротке тренування сьогодні!`;

      const sent = sendWebNotification(title, body, 'temp-inactivity-reminder');
      if (sent) {
        showToast(body);
      }
      setNotificationSettings((prev) => ({
        ...prev,
        lastInactivityNotifiedAtMs: Date.now(),
      }));
    };

    checkInactivityAndNotify();
    const timerId = window.setInterval(checkInactivityAndNotify, 30_000);
    return () => window.clearInterval(timerId);
  }, [notificationSettings, initialNotifCheck.previousLastOpenedAtMs]);

  useEffect(() => {
    const unsubscribe = initAuth((user) => {
      setGoogleUser(user);
      setDriveAccessToken(user ? getAccessToken() : null);
    });
    return unsubscribe;
  }, []);

  const handleToggleQuickTheme = () => {
    setTheme(isDarkActive ? 'light' : 'dark');
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    try {
      const { user, accessToken } = await googleSignIn();
      setGoogleUser(user);
      setDriveAccessToken(accessToken);
      setUserProfile((prev) => {
        if (prev.name.trim() || prev.avatarDataUrl) return prev;
        return {
          ...prev,
          name: user.displayName ?? prev.name,
          avatarDataUrl: user.photoURL ?? prev.avatarDataUrl,
          updatedAt: new Date().toISOString(),
        };
      });
      showToast('Google Диск підключено');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Не вдалося увійти через Google.'
      );
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    await googleLogout();
    setGoogleUser(null);
    setDriveAccessToken(null);
    showToast('Сесію Google Диска завершено');
  };

  const handleTokenExpired = () => {
    setDriveAccessToken(null);
  };

  const handleApplyCloudPayload = (
    payload: CloudBackupPayload,
    summaryText: string
  ) => {
    if (Array.isArray(payload.sessions)) {
      setSessions(payload.sessions);
    }
    if (Array.isArray(payload.exercises)) {
      setExercises(payload.exercises);
    }
    if (payload.goals && typeof payload.goals === 'object') {
      setGoals({ ...DEFAULT_GOALS, ...payload.goals });
    }
    if (payload.bodyProfile && typeof payload.bodyProfile === 'object') {
      setBodyProfile({ ...DEFAULT_BODY_PROFILE, ...payload.bodyProfile });
    }
    if (Array.isArray(payload.programs)) {
      setPrograms(payload.programs);
    }
    if (Array.isArray(payload.customTemplates)) {
      setCustomTemplates(payload.customTemplates);
    }
    if (payload.userProfile && typeof payload.userProfile === 'object') {
      setUserProfile((prev) => ({
        ...prev,
        ...payload.userProfile,
        deviceName: prev.deviceName || payload.userProfile.deviceName,
      }));
    }
    showToast(summaryText);
  };

  const streakDays = useMemo(
    () => calculateStreakDays(sessions, todayDate),
    [sessions, todayDate]
  );

  const allTemplates = useMemo(() => {
    const map = new Map<string, WorkoutTemplate>();
    for (const tpl of WORKOUT_TEMPLATES) map.set(tpl.id, tpl);
    for (const tpl of customTemplates) map.set(tpl.id, tpl);
    return Array.from(map.values());
  }, [customTemplates]);

  const activeProgram = useMemo(
    () => programs.find((p) => p.isActive),
    [programs]
  );

  const scheduledProgramDay = useMemo(
    () => getScheduledProgramDay(activeProgram, selectedDate, allTemplates),
    [activeProgram, selectedDate, allTemplates]
  );

  const handleOpenNewWorkout = () => {
    setEditingSession(null);
    setModalOpen(true);
  };

  const handleOpenNewWorkoutForDate = (date: string) => {
    setSelectedDate(date);
    setEditingSession(null);
    setModalOpen(true);
  };

  const handleEditWorkout = (session: WorkoutSession) => {
    setEditingSession(session);
    setModalOpen(true);
  };

  const handleSaveWorkoutModal = (
    session: WorkoutSession,
    mode: 'log' | 'start-live'
  ) => {
    if (mode === 'start-live') {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      setActiveLive({
        session: {
          ...session,
          date: todayDate,
          startTime: hhmm,
          completed: false,
        },
        startedAtMs: Date.now(),
        restEndAtMs: null,
        restTotalSec: 0,
      });
      setModalOpen(false);
      setActiveTab('today');
      setSelectedDate(todayDate);
      showToast('Таймер тренування запущено');
      return;
    }

    setSessions((prev) => {
      const exists = prev.some((s) => s.id === session.id);
      if (exists) {
        return prev.map((s) => (s.id === session.id ? session : s));
      }
      return [session, ...prev];
    });
    setModalOpen(false);
    setSelectedDate(session.date);
    showToast(editingSession ? 'Тренування оновлено' : 'Тренування збережено');
  };

  const handleDeleteWorkout = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    showToast('Запис видалено');
  };

  const handleDuplicateWorkout = (session: WorkoutSession) => {
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const copy: WorkoutSession = {
      ...session,
      id: `w-${Date.now()}`,
      date: todayDate,
      startTime: hhmm,
      exercises: session.exercises.map((ex, idx) => ({
        ...ex,
        id: `we-${Date.now()}-${idx}`,
        sets: ex.sets.map((s, sIdx) => ({
          ...s,
          id: `s-${Date.now()}-${idx}-${sIdx}`,
          completed: true,
        })),
      })),
      completed: true,
    };
    setSessions((prev) => [copy, ...prev]);
    setSelectedDate(todayDate);
    setActiveTab('today');
    showToast('Тренування скопійовано на сьогодні');
  };

  const handleStartTemplateLive = (template: WorkoutTemplate) => {
    if (activeLive) return;
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const liveSession: WorkoutSession = {
      id: `w-live-${Date.now()}`,
      title: template.title,
      date: todayDate,
      startTime: hhmm,
      category: template.category,
      durationMinutes: template.estimatedMinutes,
      rpe: 7,
      completed: false,
      exercises: template.exercises.map((ex, idx) => ({
        ...ex,
        id: `we-live-${Date.now()}-${idx}`,
        sets: ex.sets.map((s, sIdx) => ({
          ...s,
          id: `s-live-${Date.now()}-${idx}-${sIdx}`,
          completed: false,
        })),
      })),
    };
    setActiveLive({
      session: liveSession,
      startedAtMs: Date.now(),
      restEndAtMs: null,
      restTotalSec: 0,
    });
    setSelectedDate(todayDate);
    setActiveTab('today');
    showToast(`Розпочато: ${template.title}`);
  };

  const handleQuickAddTemplate = (template: WorkoutTemplate) => {
    const now = new Date();
    const nowMs = Date.now();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const quickSession: WorkoutSession = {
      id: `w-quick-${nowMs}`,
      title: template.title,
      date: selectedDate,
      startTime: hhmm,
      category: template.category,
      durationMinutes: template.estimatedMinutes,
      rpe: 7,
      completed: true,
      exercises: template.exercises.map((ex, idx) => ({
        ...ex,
        id: `we-quick-${nowMs}-${idx}`,
        sets: ex.sets.map((s, sIdx) => ({
          ...s,
          id: `s-quick-${nowMs}-${idx}-${sIdx}`,
          completed: true,
        })),
      })),
    };
    setSessions((prev) => [quickSession, ...prev]);
    showToast(`Швидко додано: ${template.title}`);
  };

  const handleFinishLive = (elapsedMinutes: number) => {
    if (!activeLive) return;
    const finished: WorkoutSession = {
      ...activeLive.session,
      durationMinutes: Math.max(1, elapsedMinutes),
      completed: true,
    };
    setSessions((prev) => [finished, ...prev]);
    setActiveLive(null);
    setSelectedDate(finished.date);
    showToast('Тренування завершено та збережено');
  };

  const handleAddCustomExercise = (ex: Omit<ExerciseDefinition, 'id'>) => {
    const newItem: ExerciseDefinition = {
      ...ex,
      id: `ex-custom-${Date.now()}`,
      isCustom: true,
    };
    setExercises((prev) => [newItem, ...prev]);
    showToast(`Додано вправу: ${ex.name}`);
  };

  const handleDeleteCustomExercise = (id: string) => {
    setExercises((prev) => prev.filter((e) => e.id !== id));
    showToast('Вправу видалено');
  };

  const handleSaveProgram = (program: TrainingProgram) => {
    const isExisting = programs.some((p) => p.id === program.id);
    setPrograms((prev) => {
      const updated = isExisting
        ? prev.map((p) => (p.id === program.id ? program : p))
        : [program, ...prev];
      if (program.isActive) {
        return updated.map((p) =>
          p.id === program.id ? p : { ...p, isActive: false }
        );
      }
      return updated;
    });
    showToast(isExisting ? 'Програму оновлено' : 'Нову програму створено');
  };

  const handleToggleActivateProgram = (id: string) => {
    const target = programs.find((p) => p.id === id);
    if (!target) return;
    const nextActive = !target.isActive;
    setPrograms((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          return {
            ...p,
            isActive: nextActive,
            startDate: nextActive
              ? p.startDate ?? getWeekStartMonday(todayDate)
              : p.startDate,
          };
        }
        return nextActive ? { ...p, isActive: false } : p;
      })
    );
    showToast(
      nextActive ? `Активовано: ${target.title}` : `Призупинено: ${target.title}`
    );
  };

  const handleDeleteProgram = (id: string) => {
    setPrograms((prev) => prev.filter((p) => p.id !== id));
    showToast('Програму видалено');
  };

  const handleSaveAiProgramPlan = (
    program: TrainingProgram,
    newTemplates: WorkoutTemplate[]
  ) => {
    setCustomTemplates((prev) => [...newTemplates, ...prev]);
    setPrograms((prev) => {
      const deactivated = prev.map((p) => ({ ...p, isActive: false }));
      return [program, ...deactivated];
    });
    setSelectedDate(todayDate);
    showToast(`ШІ-програму «${program.title}» збережено та активовано`);
  };

  const handleExportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      userProfile,
      sessions,
      exercises,
      goals,
      bodyProfile,
      programs,
      customTemplates,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `temp-workouts-${todayDate}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Експортовано резервну копію JSON');
  };

  const handleImportJson = (raw: string): { ok: boolean; message: string } => {
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.sessions)) {
        return { ok: false, message: 'Невірний формат файлу: відсутній список тренувань.' };
      }
      setSessions(parsed.sessions);
      if (Array.isArray(parsed.exercises)) {
        setExercises(parsed.exercises);
      }
      if (parsed.goals && typeof parsed.goals === 'object') {
        setGoals({ ...DEFAULT_GOALS, ...parsed.goals });
      }
      if (parsed.bodyProfile && typeof parsed.bodyProfile === 'object') {
        setBodyProfile({ ...DEFAULT_BODY_PROFILE, ...parsed.bodyProfile });
      }
      if (Array.isArray(parsed.programs)) {
        setPrograms(parsed.programs);
      }
      if (Array.isArray(parsed.customTemplates)) {
        setCustomTemplates(parsed.customTemplates);
      }
      if (parsed.userProfile && typeof parsed.userProfile === 'object') {
        setUserProfile((prev) => ({ ...prev, ...parsed.userProfile }));
      }
      showToast('Дані успішно імпортовано');
      return {
        ok: true,
        message: `Успішно імпортовано ${parsed.sessions.length} тренувань.`,
      };
    } catch {
      return { ok: false, message: 'Помилка читання JSON файлу.' };
    }
  };

  const handleResetDemoData = () => {
    setSessions(createSeedWorkouts(todayDate));
    setExercises(INITIAL_EXERCISES);
    setGoals(DEFAULT_GOALS);
    setBodyProfile(DEFAULT_BODY_PROFILE);
    setPrograms(createInitialPrograms(todayDate));
    setCustomTemplates([]);
    setActiveLive(null);
    setSelectedDate(todayDate);
    showToast('Початкові дані відновлено');
  };

  const navItems: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'today', label: 'Сьогодні', icon: CalendarCheck },
    { id: 'workouts', label: 'Журнал', icon: ListChecks },
    { id: 'progress', label: 'Прогрес', icon: BarChart3 },
    { id: 'exercises', label: 'Вправи і цілі', icon: Dumbbell },
    { id: 'profile', label: 'Профіль', icon: User },
    { id: 'settings', label: 'Налаштування', icon: Settings },
  ];

  const pageHeading: Record<NavTab, string> = {
    today: 'Щоденний трекер',
    workouts: 'Журнал тренувань',
    progress: 'Аналітика та рекорди',
    exercises: 'Вправи та цілі',
    profile: 'Профіль та синхронізація',
    settings: 'Налаштування',
  };

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col lg:flex-row transition-colors duration-150">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] z-30">
        <div className="h-16 px-6 flex items-center justify-between border-b border-[var(--border-subtle)]">
          <span className="font-display text-2xl font-bold tracking-tight text-[var(--text-primary)] whitespace-nowrap">
            Темп
          </span>
          <button
            type="button"
            onClick={handleToggleQuickTheme}
            title={isDarkActive ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'}
            aria-label={isDarkActive ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] transition-colors"
          >
            {isDarkActive ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1" aria-label="Головна навігація">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-900 dark:bg-orange-600 text-white'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[var(--border-subtle)] space-y-3">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className="w-full p-2.5 rounded-xl bg-[var(--bg-surface-subtle)] hover:bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] flex items-center gap-3 text-left transition-colors"
          >
            <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-900 dark:bg-orange-600 text-white flex items-center justify-center shrink-0">
              {userProfile.avatarDataUrl ? (
                <img
                  src={userProfile.avatarDataUrl}
                  alt={userProfile.name || 'Профіль'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-display text-sm font-bold">
                  {getUserInitials(userProfile.name)}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                {userProfile.name.trim() || 'Налаштувати профіль'}
              </div>
              <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5 truncate">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    googleUser && driveAccessToken
                      ? 'bg-emerald-500'
                      : 'bg-slate-400 dark:bg-slate-500'
                  }`}
                />
                <span className="truncate">
                  {googleUser && driveAccessToken
                    ? 'Google Диск активний'
                    : 'Бекап не підключено'}
                </span>
              </div>
            </div>
          </button>

          <div className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-2">
            <div className="text-xs font-medium text-[var(--text-muted)]">Тижнева норма</div>
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-mono font-semibold tabular-nums text-[var(--text-primary)]">
                {goals.workoutsPerWeek} трен.
              </span>
              <span className="text-xs font-mono tabular-nums text-[var(--text-muted)]">
                {goals.minutesPerWeek} хв
              </span>
            </div>
            <div className="text-xs text-[var(--text-muted)]">
              Серія: <span className="font-mono font-semibold text-orange-700 dark:text-orange-400">{streakDays} дн.</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        {/* Desktop Top Header */}
        <header className="hidden lg:flex h-16 px-8 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] items-center justify-between gap-8 sticky top-0 z-20">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] whitespace-nowrap">
            {pageHeading[activeTab]}
          </h1>

          <button
            type="button"
            onClick={handleOpenNewWorkout}
            className="min-h-[40px] px-4 py-2 text-sm font-semibold rounded-xl bg-orange-600 hover:bg-orange-700 text-white transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Додати тренування
          </button>
        </header>

        {/* Mobile Compact Top Header (48px) */}
        <header className="lg:hidden h-12 px-4 bg-[var(--bg-surface)]/95 backdrop-blur-md border-b border-[var(--border-subtle)] flex items-center justify-between gap-4 sticky top-0 z-30">
          <span className="font-display text-xl font-bold tracking-tight text-[var(--text-primary)] whitespace-nowrap">
            Темп
          </span>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleToggleQuickTheme}
              title={isDarkActive ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'}
              aria-label={isDarkActive ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'}
              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] transition-colors"
            >
              {isDarkActive ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={handleOpenNewWorkout}
              className="min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg bg-orange-600 hover:bg-orange-700 text-white transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Тренування
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-10 space-y-6">
          {activeLive && (
            <LiveSessionBanner
              active={activeLive}
              weightReminderEnabled={
                notificationSettings.weightReminderAfterExercise
              }
              notificationsEnabled={notificationSettings.enabled}
              onUpdateSession={(updated) =>
                setActiveLive((prev) => (prev ? { ...prev, session: updated } : null))
              }
              onStartRest={(sec) =>
                setActiveLive((prev) =>
                  prev
                    ? {
                        ...prev,
                        restEndAtMs: Date.now() + sec * 1000,
                        restTotalSec: sec,
                      }
                    : null
                )
              }
              onClearRest={() =>
                setActiveLive((prev) =>
                  prev ? { ...prev, restEndAtMs: null, restTotalSec: 0 } : null
                )
              }
              onFinish={handleFinishLive}
              onDiscard={() => {
                setActiveLive(null);
                showToast('Активну сесію скасовано');
              }}
              onNotify={showToast}
            />
          )}

          {activeTab === 'today' && (
            <TodayView
              todayDate={todayDate}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              sessions={sessions}
              goals={goals}
              streakDays={streakDays}
              templates={allTemplates}
              scheduledProgramDay={scheduledProgramDay}
              hasActiveLive={Boolean(activeLive)}
              onOpenNewWorkout={handleOpenNewWorkout}
              onEditWorkout={handleEditWorkout}
              onDeleteWorkout={handleDeleteWorkout}
              onDuplicateWorkout={handleDuplicateWorkout}
              onStartTemplateLive={handleStartTemplateLive}
              onQuickAddTemplate={handleQuickAddTemplate}
              onOpenAiPlanModal={() => setAiModalOpen(true)}
              onNotify={showToast}
            />
          )}

          {activeTab === 'workouts' && (
            <WorkoutsView
              sessions={sessions}
              templates={allTemplates}
              programs={programs}
              todayDate={todayDate}
              hasActiveLive={Boolean(activeLive)}
              onOpenNewWorkout={handleOpenNewWorkout}
              onOpenNewWorkoutForDate={handleOpenNewWorkoutForDate}
              onEditWorkout={handleEditWorkout}
              onDeleteWorkout={handleDeleteWorkout}
              onDuplicateWorkout={handleDuplicateWorkout}
              onStartTemplateLive={handleStartTemplateLive}
              onSaveProgram={handleSaveProgram}
              onToggleActivateProgram={handleToggleActivateProgram}
              onDeleteProgram={handleDeleteProgram}
              onOpenAiPlanModal={() => setAiModalOpen(true)}
              onNotify={showToast}
            />
          )}

          {activeTab === 'progress' && (
            <ProgressView
              todayDate={todayDate}
              sessions={sessions}
              goals={goals}
            />
          )}

          {activeTab === 'exercises' && (
            <ExercisesGoalsView
              exercises={exercises}
              goals={goals}
              bodyProfile={bodyProfile}
              onAddExercise={handleAddCustomExercise}
              onDeleteCustomExercise={handleDeleteCustomExercise}
              onUpdateGoals={setGoals}
              onUpdateBodyProfile={setBodyProfile}
              onExportJson={handleExportJson}
              onImportJson={handleImportJson}
              onResetDemoData={handleResetDemoData}
            />
          )}
          {activeTab === 'profile' && (
            <ProfileView
              userProfile={userProfile}
              onUpdateProfile={setUserProfile}
              sessions={sessions}
              exercises={exercises}
              goals={goals}
              bodyProfile={bodyProfile}
              programs={programs}
              customTemplates={customTemplates}
              theme={theme}
              onApplyCloudPayload={handleApplyCloudPayload}
              googleUser={googleUser}
              driveAccessToken={driveAccessToken}
              isSigningIn={isSigningIn}
              onGoogleSignIn={handleGoogleSignIn}
              onGoogleLogout={handleGoogleLogout}
              onTokenExpired={handleTokenExpired}
              onNotify={showToast}
            />
          )}
          {activeTab === 'settings' && (
            <SettingsView
              theme={theme}
              notificationSettings={notificationSettings}
              onUpdateTheme={(nextTheme) => {
                setTheme(nextTheme);
                showToast(
                  nextTheme === 'dark'
                    ? 'Увімкнено темну тему'
                    : nextTheme === 'light'
                      ? 'Увімкнено світлу тему'
                      : 'Увімкнено системну тему'
                );
              }}
              onUpdateNotificationSettings={setNotificationSettings}
              onNotify={showToast}
            />
          )}
        </main>
      </div>

      {/* Mobile Fixed Bottom Tab Bar (60px) */}
      <nav
        aria-label="Мобільна навігація"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-[60px] bg-[var(--bg-surface)]/95 backdrop-blur-md border-t border-[var(--border-subtle)] grid grid-cols-6 items-center"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`min-h-[44px] h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
                isActive
                  ? 'text-orange-600 dark:text-orange-400'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-semibold tracking-tight whitespace-nowrap">
                {item.id === 'exercises'
                  ? 'Вправи'
                  : item.id === 'settings'
                    ? 'Налашт.'
                    : item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Create / Edit Workout Modal */}
      {modalOpen && (
        <WorkoutModal
          initialSession={editingSession}
          defaultDate={selectedDate}
          exercisesCatalog={exercises}
          historySessions={sessions}
          onSave={handleSaveWorkoutModal}
          onClose={() => setModalOpen(false)}
        />
      )}

      {/* AI Workout Plan Generator Modal */}
      {aiModalOpen && (
        <AiPlanGeneratorModal
          todayDate={todayDate}
          hasActiveLive={Boolean(activeLive)}
          onSaveProgramPlan={handleSaveAiProgramPlan}
          onStartTemplateLive={handleStartTemplateLive}
          onClose={() => setAiModalOpen(false)}
        />
      )}

      {/* Subtle Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 lg:bottom-6 right-4 sm:right-6 z-50 px-4 py-3 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium shadow-lg"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
