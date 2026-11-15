import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  AlertTriangle,
  Camera,
  Check,
  Cloud,
  CloudOff,
  Download,
  HardDrive,
  Laptop,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
  Upload,
  User as UserIcon,
  X,
} from 'lucide-react';
import {
  createDriveBackup,
  deleteDriveBackup,
  downloadDriveBackup,
  DRIVE_BACKUP_FILENAME,
  DriveAuthError,
  findDriveBackupFile,
  formatBackupSize,
  getUserInitials,
  mergeCloudBackup,
  resizeProfileImageToDataUrl,
  updateDriveBackup,
} from '../services/googleDriveSync';
import type {
  BodyProfile,
  CloudBackupPayload,
  DriveBackupFileMeta,
  ExerciseDefinition,
  SyncMergeSummary,
  ThemeMode,
  TrainingProgram,
  UserProfile,
  WeeklyGoals,
  WorkoutSession,
  WorkoutTemplate,
} from '../types/workout';

interface ProfileViewProps {
  userProfile: UserProfile;
  onUpdateProfile: (profile: UserProfile) => void;
  sessions: WorkoutSession[];
  exercises: ExerciseDefinition[];
  goals: WeeklyGoals;
  bodyProfile: BodyProfile;
  programs: TrainingProgram[];
  customTemplates: WorkoutTemplate[];
  theme: ThemeMode;
  onApplyCloudPayload: (payload: CloudBackupPayload, summaryText: string) => void;
  googleUser: User | null;
  driveAccessToken: string | null;
  isSigningIn: boolean;
  onGoogleSignIn: () => Promise<void>;
  onGoogleLogout: () => Promise<void>;
  onTokenExpired: () => void;
  onNotify: (msg: string) => void;
}

type PendingConfirmAction =
  | { type: 'overwrite-drive' }
  | { type: 'restore'; mode: 'merge' | 'replace' }
  | { type: 'delete-drive' };

function formatDateTimeUk(isoString?: string): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function GoogleSignInButton({
  onClick,
  disabled,
  label,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-[44px] px-4 py-2 rounded-[4px] border border-[#747775] dark:border-[#8E918F] bg-white hover:bg-[#F8FAFD] active:bg-[#EEF2F6] dark:bg-[#131314] dark:hover:bg-[#1E1F20] dark:active:bg-[#28292A] text-[#1F1F1F] dark:text-[#E3E3E3] text-sm font-medium tracking-[0.25px] inline-flex items-center justify-center gap-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
    >
      <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 48 48" aria-hidden="true">
        <path
          fill="#EA4335"
          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        />
        <path
          fill="#4285F4"
          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        />
        <path
          fill="#FBBC05"
          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        />
        <path
          fill="#34A853"
          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        />
      </svg>
      <span>{label}</span>
    </button>
  );
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  userProfile,
  onUpdateProfile,
  sessions,
  exercises,
  goals,
  bodyProfile,
  programs,
  customTemplates,
  theme,
  onApplyCloudPayload,
  googleUser,
  driveAccessToken,
  isSigningIn,
  onGoogleSignIn,
  onGoogleLogout,
  onTokenExpired,
  onNotify,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [draftName, setDraftName] = useState(userProfile.name);
  const [draftBio, setDraftBio] = useState(userProfile.bio ?? '');
  const [draftDeviceName, setDraftDeviceName] = useState(
    userProfile.deviceName ?? 'Веб-браузер'
  );
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  const [remoteMeta, setRemoteMeta] = useState<DriveBackupFileMeta | null>(null);
  const [remotePayload, setRemotePayload] = useState<CloudBackupPayload | null>(null);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveMutating, setDriveMutating] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmAction | null>(null);
  const [needsCloudPushAfterMerge, setNeedsCloudPushAfterMerge] = useState(false);
  const [lastMergeSummary, setLastMergeSummary] = useState<SyncMergeSummary | null>(null);

  useEffect(() => {
    setDraftName(userProfile.name);
    setDraftBio(userProfile.bio ?? '');
    setDraftDeviceName(userProfile.deviceName ?? 'Веб-браузер');
    setAvatarLoadError(false);
  }, [userProfile]);

  useEffect(() => {
    if (!pendingConfirm) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !driveMutating) {
        setPendingConfirm(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pendingConfirm, driveMutating]);

  const isProfileDirty =
    draftName.trim() !== userProfile.name.trim() ||
    draftBio.trim() !== (userProfile.bio ?? '').trim() ||
    draftDeviceName.trim() !== (userProfile.deviceName ?? 'Веб-браузер').trim();

  const buildLocalPayload = useCallback((): CloudBackupPayload => {
    const cleanDevice = draftDeviceName.trim() || userProfile.deviceName || 'Веб-браузер';
    const effectiveProfile: UserProfile = {
      ...userProfile,
      name: draftName.trim() || userProfile.name,
      bio: draftBio.trim(),
      deviceName: cleanDevice,
      updatedAt: userProfile.updatedAt || new Date().toISOString(),
    };
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      deviceName: cleanDevice,
      userProfile: effectiveProfile,
      sessions,
      exercises,
      goals,
      bodyProfile,
      programs,
      customTemplates,
      theme,
    };
  }, [
    bodyProfile,
    customTemplates,
    draftBio,
    draftDeviceName,
    draftName,
    exercises,
    goals,
    programs,
    sessions,
    theme,
    userProfile,
  ]);

  const refreshCloudStatus = useCallback(async () => {
    if (!driveAccessToken) return;
    setDriveLoading(true);
    setDriveError(null);
    try {
      const file = await findDriveBackupFile(driveAccessToken);
      setRemoteMeta(file);
      if (file) {
        const downloaded = await downloadDriveBackup(driveAccessToken, file.id);
        setRemotePayload(downloaded);
      } else {
        setRemotePayload(null);
      }
    } catch (err) {
      if (err instanceof DriveAuthError) {
        onTokenExpired();
        setDriveError(err.message);
      } else {
        setDriveError(
          err instanceof Error
            ? err.message
            : 'Не вдалося перевірити резервну копію на Google Диску.'
        );
      }
    } finally {
      setDriveLoading(false);
    }
  }, [driveAccessToken, onTokenExpired]);

  useEffect(() => {
    if (googleUser && driveAccessToken) {
      void refreshCloudStatus();
    } else {
      setRemoteMeta(null);
      setRemotePayload(null);
    }
  }, [googleUser, driveAccessToken, refreshCloudStatus]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: UserProfile = {
      ...userProfile,
      name: draftName.trim(),
      bio: draftBio.trim(),
      deviceName: draftDeviceName.trim() || 'Веб-браузер',
      updatedAt: new Date().toISOString(),
    };
    onUpdateProfile(updated);
    onNotify('Профіль збережено');
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setPhotoBusy(true);
    try {
      const dataUrl = await resizeProfileImageToDataUrl(file, 256);
      setAvatarLoadError(false);
      onUpdateProfile({
        ...userProfile,
        name: draftName.trim() || userProfile.name,
        bio: draftBio.trim(),
        deviceName: draftDeviceName.trim() || userProfile.deviceName || 'Веб-браузер',
        avatarDataUrl: dataUrl,
        updatedAt: new Date().toISOString(),
      });
      onNotify('Фото профілю оновлено');
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Не вдалося завантажити фото профілю.'
      );
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleRemovePhoto = () => {
    onUpdateProfile({
      ...userProfile,
      avatarDataUrl: undefined,
      updatedAt: new Date().toISOString(),
    });
    onNotify('Фото профілю видалено');
  };

  const handleFillFromGoogle = () => {
    if (!googleUser) return;
    const nextName = draftName.trim() || googleUser.displayName || '';
    const nextAvatar = userProfile.avatarDataUrl || googleUser.photoURL || undefined;
    setDraftName(nextName);
    setAvatarLoadError(false);
    onUpdateProfile({
      ...userProfile,
      name: nextName,
      avatarDataUrl: nextAvatar,
      updatedAt: new Date().toISOString(),
    });
    onNotify('Дані профілю заповнено з Google-акаунту');
  };

  const handleBackupClick = async () => {
    if (!driveAccessToken) return;
    if (remoteMeta) {
      setPendingConfirm({ type: 'overwrite-drive' });
      return;
    }

    // First-time creation of temp-workout-backup.json
    setDriveMutating(true);
    setDriveError(null);
    try {
      const payload = buildLocalPayload();
      const created = await createDriveBackup(driveAccessToken, payload);
      setRemoteMeta(created);
      setRemotePayload(payload);
      setNeedsCloudPushAfterMerge(false);
      onNotify('Резервну копію створено на Google Диску');
    } catch (err) {
      if (err instanceof DriveAuthError) {
        onTokenExpired();
        setDriveError(err.message);
      } else {
        setDriveError(
          err instanceof Error ? err.message : 'Помилка створення резервної копії.'
        );
      }
    } finally {
      setDriveMutating(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!pendingConfirm) return;

    if (pendingConfirm.type === 'overwrite-drive') {
      if (!driveAccessToken || !remoteMeta) return;
      setDriveMutating(true);
      setDriveError(null);
      try {
        const payload = buildLocalPayload();
        const updated = await updateDriveBackup(
          driveAccessToken,
          remoteMeta.id,
          payload
        );
        setRemoteMeta(updated);
        setRemotePayload(payload);
        setNeedsCloudPushAfterMerge(false);
        setPendingConfirm(null);
        onNotify('Резервну копію на Google Диску оновлено');
      } catch (err) {
        if (err instanceof DriveAuthError) {
          onTokenExpired();
          setDriveError(err.message);
          setPendingConfirm(null);
        } else {
          setDriveError(
            err instanceof Error ? err.message : 'Помилка оновлення резервної копії.'
          );
        }
      } finally {
        setDriveMutating(false);
      }
      return;
    }

    if (pendingConfirm.type === 'delete-drive') {
      if (!driveAccessToken || !remoteMeta) return;
      setDriveMutating(true);
      setDriveError(null);
      try {
        await deleteDriveBackup(driveAccessToken, remoteMeta.id);
        setRemoteMeta(null);
        setRemotePayload(null);
        setNeedsCloudPushAfterMerge(false);
        setPendingConfirm(null);
        onNotify('Резервну копію видалено з Google Диска');
      } catch (err) {
        if (err instanceof DriveAuthError) {
          onTokenExpired();
          setDriveError(err.message);
          setPendingConfirm(null);
        } else {
          setDriveError(
            err instanceof Error ? err.message : 'Помилка видалення резервної копії.'
          );
        }
      } finally {
        setDriveMutating(false);
      }
      return;
    }

    if (pendingConfirm.type === 'restore') {
      if (!remotePayload) return;
      const localPayload = buildLocalPayload();

      if (pendingConfirm.mode === 'replace') {
        const replacedPayload: CloudBackupPayload = {
          ...remotePayload,
          deviceName: localPayload.deviceName,
          userProfile: {
            ...remotePayload.userProfile,
            deviceName: localPayload.deviceName,
          },
        };
        setLastMergeSummary(null);
        setNeedsCloudPushAfterMerge(false);
        setPendingConfirm(null);
        onApplyCloudPayload(
          replacedPayload,
          `Відновлено ${replacedPayload.sessions.length} тренувань з Google Диска`
        );
        return;
      }

      const { merged, summary } = mergeCloudBackup(localPayload, remotePayload);
      setLastMergeSummary(summary);
      setNeedsCloudPushAfterMerge(
        localPayload.sessions.length > (remotePayload.sessions?.length ?? 0) ||
          merged.sessions.length > (remotePayload.sessions?.length ?? 0)
      );
      setPendingConfirm(null);

      const parts: string[] = [];
      if (summary.addedSessions > 0) {
        parts.push(`+${summary.addedSessions} трен.`);
      }
      if (summary.addedPrograms > 0) {
        parts.push(`+${summary.addedPrograms} прогр.`);
      }
      if (summary.addedExercises > 0) {
        parts.push(`+${summary.addedExercises} вправ`);
      }
      const summaryText =
        parts.length > 0
          ? `Синхронізовано з Google Диском (${parts.join(', ')})`
          : 'Дані успішно синхронізовано з Google Диском';
      onApplyCloudPayload(merged, summaryText);
    }
  };

  const syncFreshnessLabel = useMemo(() => {
    if (!remotePayload || !remoteMeta) return null;
    const remoteMs = Date.parse(remotePayload.updatedAt || remoteMeta.modifiedTime) || 0;
    const localMs = Date.parse(userProfile.updatedAt) || 0;
    const remoteSessionCount = remotePayload.sessions?.length ?? 0;

    if (remoteSessionCount > sessions.length) {
      return {
        text: `У хмарі більше тренувань (${remoteSessionCount} проти ${sessions.length} на цьому пристрої)`,
        tone: 'text-orange-600 dark:text-orange-400',
      };
    }
    if (sessions.length > remoteSessionCount) {
      return {
        text: `На цьому пристрої більше тренувань (${sessions.length} проти ${remoteSessionCount} у хмарі) — варто оновити бекап`,
        tone: 'text-amber-600 dark:text-amber-400',
      };
    }
    if (remoteMs > localMs + 60_000) {
      return {
        text: 'Копія на Google Диску новіша за останні локальні зміни профілю',
        tone: 'text-orange-600 dark:text-orange-400',
      };
    }
    return {
      text: 'Кількість тренувань збігається з копією на Google Диску',
      tone: 'text-emerald-600 dark:text-emerald-400',
    };
  }, [remoteMeta, remotePayload, sessions.length, userProfile.updatedAt]);

  const customExercisesCount = useMemo(
    () => exercises.filter((e) => e.isCustom).length,
    [exercises]
  );

  const displayAvatar = !avatarLoadError ? userProfile.avatarDataUrl : undefined;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: User Profile */}
        <section className="lg:col-span-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-6 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Профіль атлета
              </h2>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                Ім’я та фото зберігаються локально і входять у резервну копію.
              </p>
            </div>
            <UserIcon className="w-5 h-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
          </div>

          {/* Avatar Row */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 pb-5 border-b border-[var(--border-subtle)]">
            <div className="relative w-24 h-24 rounded-2xl overflow-hidden bg-slate-900 dark:bg-orange-600 text-white flex items-center justify-center shrink-0 border border-[var(--border-subtle)]">
              {displayAvatar ? (
                <img
                  src={displayAvatar}
                  alt={draftName || 'Фото профілю'}
                  onError={() => setAvatarLoadError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-display text-3xl font-bold tracking-tight">
                  {getUserInitials(draftName || userProfile.name)}
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-2.5">
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={photoBusy}
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[var(--bg-surface-subtle)] hover:bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] inline-flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Camera className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  {photoBusy ? 'Обробка...' : displayAvatar ? 'Змінити фото' : 'Додати фото'}
                </button>

                {displayAvatar && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="min-h-[40px] px-3 py-2 rounded-xl border border-[var(--border-subtle)] hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold text-[var(--text-secondary)] hover:text-rose-600 dark:hover:text-rose-400 inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Видалити
                  </button>
                )}
              </div>

              {googleUser && (googleUser.displayName || googleUser.photoURL) && (
                <button
                  type="button"
                  onClick={handleFillFromGoogle}
                  className="text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline inline-flex items-center gap-1"
                >
                  Підставити ім’я та фото з Google-акаунту
                </button>
              )}

              <p className="text-xs text-[var(--text-muted)]">
                Фото автоматично стискається до 256×256 px для швидкої синхронізації.
              </p>
            </div>
          </div>

          {/* Profile Form */}
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label
                htmlFor="profile-name"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5"
              >
                Ім’я або нікнейм
              </label>
              <input
                id="profile-name"
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                maxLength={60}
                placeholder="Наприклад, Олександр Коваленко"
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label
                htmlFor="profile-bio"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5"
              >
                Спортивна мета або нотатка
              </label>
              <input
                id="profile-bio"
                type="text"
                value={draftBio}
                onChange={(e) => setDraftBio(e.target.value)}
                maxLength={120}
                placeholder="Наприклад, 4 тренування на тиждень · сила та витривалість"
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label
                htmlFor="profile-device"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5"
              >
                Назва цього пристрою (для мітки в бекапі)
              </label>
              <div className="relative">
                <input
                  id="profile-device"
                  type="text"
                  value={draftDeviceName}
                  onChange={(e) => setDraftDeviceName(e.target.value)}
                  maxLength={50}
                  placeholder="Наприклад, Мій телефон або Ноутбук"
                  className="w-full min-h-[44px] pl-10 pr-3.5 py-2.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-orange-500"
                />
                {/iPhone|Android|iPad|Телефон/i.test(draftDeviceName) ? (
                  <Smartphone className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                ) : (
                  <Laptop className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                )}
              </div>
            </div>

            <div className="pt-1 flex items-center justify-between gap-3">
              <span className="text-xs text-[var(--text-muted)]">
                Оновлено: {formatDateTimeUk(userProfile.updatedAt)}
              </span>

              <button
                type="submit"
                className={`min-h-[44px] px-5 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2 transition-colors ${
                  isProfileDirty
                    ? 'bg-orange-600 hover:bg-orange-700 text-white'
                    : 'bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900'
                }`}
              >
                <Check className="w-4 h-4" />
                Зберегти профіль
              </button>
            </div>
          </form>

          {/* Local Snapshot Metrics */}
          <div className="pt-5 border-t border-[var(--border-subtle)]">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
              Дані на цьому пристрої
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]">
                <div className="text-xs text-[var(--text-muted)]">Тренувань</div>
                <div className="text-lg font-mono font-semibold tabular-nums text-[var(--text-primary)] mt-0.5">
                  {sessions.length}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]">
                <div className="text-xs text-[var(--text-muted)]">Програм</div>
                <div className="text-lg font-mono font-semibold tabular-nums text-[var(--text-primary)] mt-0.5">
                  {programs.length}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]">
                <div className="text-xs text-[var(--text-muted)]">Своїх вправ</div>
                <div className="text-lg font-mono font-semibold tabular-nums text-[var(--text-primary)] mt-0.5">
                  {customExercisesCount}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]">
                <div className="text-xs text-[var(--text-muted)]">ШІ/своїх шаблонів</div>
                <div className="text-lg font-mono font-semibold tabular-nums text-[var(--text-primary)] mt-0.5">
                  {customTemplates.length}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Google Drive Backup & Cross-Device Sync */}
        <section className="lg:col-span-7 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-6 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Cloud className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                Google Диск: бекап і синхронізація
              </h2>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                Зберігайте профіль, історію тренувань і програми у хмарі та переносьте їх між телефоном і комп’ютером.
              </p>
            </div>
          </div>

          {driveError && (
            <div
              role="alert"
              className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-sm text-rose-700 dark:text-rose-300 flex items-start gap-3"
            >
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">{driveError}</div>
            </div>
          )}

          {/* Authentication State */}
          {!googleUser || !driveAccessToken ? (
            <div className="p-5 rounded-2xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-600/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                  <CloudOff className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-[var(--text-primary)]">
                    {googleUser
                      ? `Акаунт ${googleUser.email ?? ''} потребує підтвердження сесії`
                      : 'Підключіть Google Диск'}
                  </div>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {googleUser
                      ? 'З міркувань безпеки доступ до Google Диска зберігається лише в оперативній пам’яті вкладки. Натисніть кнопку нижче, щоб підключити синхронізацію у цій сесії.'
                      : `Додаток отримує доступ лише до власного файлу резервної копії (${DRIVE_BACKUP_FILENAME}) і не бачить інші ваші файли на Google Диску.`}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <GoogleSignInButton
                  onClick={() => void onGoogleSignIn()}
                  disabled={isSigningIn}
                  label={
                    isSigningIn
                      ? 'Підключення...'
                      : googleUser
                        ? 'Підключити Google Диск у цій сесії'
                        : 'Увійти через Google'
                  }
                />

                {googleUser && (
                  <button
                    type="button"
                    onClick={() => void onGoogleLogout()}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-muted)] text-xs font-semibold text-[var(--text-secondary)] inline-flex items-center gap-2 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Вийти з акаунту
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Connected Account Header */}
              <div className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {googleUser.photoURL ? (
                    <img
                      src={googleUser.photoURL}
                      alt={googleUser.displayName ?? 'Google'}
                      className="w-10 h-10 rounded-xl object-cover border border-[var(--border-subtle)] shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {googleUser.displayName || 'Google акаунт підключено'}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] truncate flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <span className="truncate">{googleUser.email}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={driveLoading || driveMutating}
                    onClick={() => void refreshCloudStatus()}
                    className="min-h-[40px] px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-muted)] text-xs font-semibold text-[var(--text-secondary)] inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${driveLoading ? 'animate-spin' : ''}`} />
                    Перевірити
                  </button>

                  <button
                    type="button"
                    disabled={driveMutating}
                    onClick={() => void onGoogleLogout()}
                    className="min-h-[40px] px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-muted)] text-xs font-semibold text-[var(--text-secondary)] inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Вийти
                  </button>
                </div>
              </div>

              {/* Remote Backup Status Card */}
              <div className="p-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                    <HardDrive className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    <span>Стан копії на Google Диску</span>
                  </div>
                  <span className="text-xs font-mono text-[var(--text-muted)]">
                    {DRIVE_BACKUP_FILENAME}
                  </span>
                </div>

                {driveLoading ? (
                  <div className="py-6 text-sm text-[var(--text-muted)] flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-orange-600" />
                    Перевірка файлів на Google Диску...
                  </div>
                ) : remoteMeta && remotePayload ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                        <div className="text-xs text-[var(--text-muted)]">Оновлено</div>
                        <div className="text-xs font-mono font-semibold text-[var(--text-primary)] mt-1 tabular-nums">
                          {formatDateTimeUk(remotePayload.updatedAt || remoteMeta.modifiedTime)}
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                        <div className="text-xs text-[var(--text-muted)]">Пристрій</div>
                        <div className="text-xs font-semibold text-[var(--text-primary)] mt-1 truncate">
                          {remotePayload.deviceName || 'Невідомо'}
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                        <div className="text-xs text-[var(--text-muted)]">Тренувань у хмарі</div>
                        <div className="text-sm font-mono font-semibold text-[var(--text-primary)] mt-0.5 tabular-nums">
                          {remotePayload.sessions?.length ?? 0}
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                        <div className="text-xs text-[var(--text-muted)]">Програм / Розмір</div>
                        <div className="text-sm font-mono font-semibold text-[var(--text-primary)] mt-0.5 tabular-nums">
                          {remotePayload.programs?.length ?? 0} · {formatBackupSize(remoteMeta.size)}
                        </div>
                      </div>
                    </div>

                    {remotePayload.userProfile?.name && (
                      <div className="text-xs text-[var(--text-secondary)]">
                        Профіль у копії:{' '}
                        <span className="font-semibold text-[var(--text-primary)]">
                          {remotePayload.userProfile.name}
                        </span>
                      </div>
                    )}

                    {syncFreshnessLabel && (
                      <div className={`text-xs font-medium ${syncFreshnessLabel.tone}`}>
                        {syncFreshnessLabel.text}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-3 text-sm text-[var(--text-secondary)]">
                    На цьому Google Диску ще немає збереженої резервної копії. Натисніть «Створити бекап на Google Диск», щоб зберегти профіль і тренування.
                  </div>
                )}
              </div>

              {/* Post-merge push prompt */}
              {needsCloudPushAfterMerge && remoteMeta && (
                <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs sm:text-sm text-orange-900 dark:text-orange-200">
                    Об’єднані дані містять записи з обох пристроїв. Оновіть копію в хмарі, щоб інший пристрій також отримав повну історію.
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingConfirm({ type: 'overwrite-drive' })}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold transition-colors shrink-0"
                  >
                    Оновити копію в хмарі
                  </button>
                </div>
              )}

              {lastMergeSummary && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-xs text-emerald-800 dark:text-emerald-200">
                  Остання синхронізація: додано тренувань —{' '}
                  <span className="font-mono font-semibold tabular-nums">
                    {lastMergeSummary.addedSessions}
                  </span>
                  , оновлено —{' '}
                  <span className="font-mono font-semibold tabular-nums">
                    {lastMergeSummary.updatedSessions}
                  </span>
                  , нових програм —{' '}
                  <span className="font-mono font-semibold tabular-nums">
                    {lastMergeSummary.addedPrograms}
                  </span>
                  , нових вправ —{' '}
                  <span className="font-mono font-semibold tabular-nums">
                    {lastMergeSummary.addedExercises}
                  </span>
                  .
                </div>
              )}

              {/* Primary Sync Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={driveLoading || driveMutating}
                  onClick={() => void handleBackupClick()}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  {remoteMeta
                    ? 'Оновити бекап на Google Диску'
                    : 'Створити бекап на Google Диск'}
                </button>

                {remoteMeta && remotePayload && (
                  <button
                    type="button"
                    disabled={driveLoading || driveMutating}
                    onClick={() => setPendingConfirm({ type: 'restore', mode: 'merge' })}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 text-sm font-semibold inline-flex items-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    Синхронізувати з Google Диска
                  </button>
                )}

                {remoteMeta && (
                  <button
                    type="button"
                    disabled={driveLoading || driveMutating}
                    onClick={() => setPendingConfirm({ type: 'delete-drive' })}
                    className="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] hover:bg-rose-50 dark:hover:bg-rose-950/30 text-sm font-semibold text-[var(--text-secondary)] hover:text-rose-600 dark:hover:text-rose-400 inline-flex items-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Видалити копію
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Cross-device Instructions */}
          <div className="pt-5 border-t border-[var(--border-subtle)] space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Як синхронізувати між телефоном і комп’ютером
            </div>
            <ol className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[var(--text-secondary)]">
              <li className="p-3.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-1">
                <div className="font-mono font-semibold text-orange-600 dark:text-orange-400">
                  01 · На першому пристрої
                </div>
                <p>
                  Заповніть профіль, увійдіть через Google та створіть резервну копію.
                </p>
              </li>
              <li className="p-3.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-1">
                <div className="font-mono font-semibold text-orange-600 dark:text-orange-400">
                  02 · На іншому пристрої
                </div>
                <p>
                  Відкрийте додаток та увійдіть у той самий Google-акаунт у вкладці «Профіль».
                </p>
              </li>
              <li className="p-3.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-1">
                <div className="font-mono font-semibold text-orange-600 dark:text-orange-400">
                  03 · Розумне злиття
                </div>
                <p>
                  Натисніть «Синхронізувати з Google Диска» — нові тренування з обох пристроїв об’єднаються без втрат.
                </p>
              </li>
            </ol>
          </div>
        </section>
      </div>

      {/* Mandatory Confirmation Modal before any Drive mutation / restore / deletion */}
      {pendingConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="drive-confirm-title"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => {
            if (!driveMutating) setPendingConfirm(null);
          }}
        >
          <div
            className="w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    pendingConfirm.type === 'delete-drive'
                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                      : 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
                  }`}
                >
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3
                    id="drive-confirm-title"
                    className="text-base font-semibold text-[var(--text-primary)]"
                  >
                    {pendingConfirm.type === 'overwrite-drive' &&
                      'Оновити файл резервної копії?'}
                    {pendingConfirm.type === 'restore' &&
                      'Синхронізувати дані з Google Диска?'}
                    {pendingConfirm.type === 'delete-drive' &&
                      'Видалити резервну копію з Google Диска?'}
                  </h3>
                  <p className="text-xs font-mono text-[var(--text-muted)] mt-0.5">
                    Файл: {DRIVE_BACKUP_FILENAME}
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={driveMutating}
                onClick={() => setPendingConfirm(null)}
                aria-label="Закрити"
                className="min-h-[36px] min-w-[36px] rounded-lg hover:bg-[var(--bg-surface-muted)] flex items-center justify-center text-[var(--text-muted)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {pendingConfirm.type === 'overwrite-drive' && remotePayload && (
              <div className="space-y-3 text-sm text-[var(--text-secondary)]">
                <p>
                  Існуюча хмарна копія буде перезаписана актуальними даними з цього пристрою.
                </p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-1">
                    <div className="font-semibold text-[var(--text-muted)]">Зараз у хмарі</div>
                    <div className="font-mono font-semibold text-[var(--text-primary)] tabular-nums">
                      {remotePayload.sessions?.length ?? 0} трен. · {remotePayload.programs?.length ?? 0} прогр.
                    </div>
                    <div className="text-[var(--text-muted)] truncate">
                      {remotePayload.deviceName || 'Пристрій'} · {formatDateTimeUk(remotePayload.updatedAt)}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-orange-50/70 dark:bg-orange-950/25 border border-orange-200 dark:border-orange-900/50 space-y-1">
                    <div className="font-semibold text-orange-700 dark:text-orange-400">Буде записано</div>
                    <div className="font-mono font-semibold text-[var(--text-primary)] tabular-nums">
                      {sessions.length} трен. · {programs.length} прогр.
                    </div>
                    <div className="text-[var(--text-muted)] truncate">
                      {draftDeviceName || 'Цей пристрій'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {pendingConfirm.type === 'restore' && remotePayload && (
              <div className="space-y-4">
                <p className="text-sm text-[var(--text-secondary)]">
                  Оберіть спосіб синхронізації з копією від{' '}
                  <span className="font-semibold text-[var(--text-primary)]">
                    {formatDateTimeUk(remotePayload.updatedAt || remoteMeta?.modifiedTime)}
                  </span>{' '}
                  ({remotePayload.sessions?.length ?? 0} тренувань, пристрій «{remotePayload.deviceName || 'Інший'}»):
                </p>

                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => setPendingConfirm({ type: 'restore', mode: 'merge' })}
                    className={`w-full text-left p-3.5 rounded-xl border transition-colors ${
                      pendingConfirm.mode === 'merge'
                        ? 'border-orange-500 bg-orange-50/70 dark:bg-orange-950/30'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] hover:bg-[var(--bg-surface-muted)]'
                    }`}
                  >
                    <div className="text-sm font-semibold text-[var(--text-primary)]">
                      Розумне злиття (рекомендовано)
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                      Збереже всі ваші поточні тренування ({sessions.length}) та додасть записи з Google Диска ({remotePayload.sessions?.length ?? 0}).
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPendingConfirm({ type: 'restore', mode: 'replace' })}
                    className={`w-full text-left p-3.5 rounded-xl border transition-colors ${
                      pendingConfirm.mode === 'replace'
                        ? 'border-orange-500 bg-orange-50/70 dark:bg-orange-950/30'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] hover:bg-[var(--bg-surface-muted)]'
                    }`}
                  >
                    <div className="text-sm font-semibold text-[var(--text-primary)]">
                      Повна заміна даних на цьому пристрої
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                      Повністю замінить локальний профіль, тренування та програми копією з Google Диска.
                    </div>
                  </button>
                </div>
              </div>
            )}

            {pendingConfirm.type === 'delete-drive' && (
              <p className="text-sm text-[var(--text-secondary)]">
                Файл <span className="font-mono font-semibold text-[var(--text-primary)]">{DRIVE_BACKUP_FILENAME}</span> буде назавжди видалено з вашого Google Диска. Локальні дані на цьому пристрої залишаться без змін.
              </p>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={driveMutating}
                onClick={() => setPendingConfirm(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-muted)] text-sm font-semibold text-[var(--text-secondary)] transition-colors disabled:opacity-50"
              >
                Скасувати
              </button>

              <button
                type="button"
                disabled={driveMutating}
                onClick={() => void handleConfirmAction()}
                className={`min-h-[44px] px-5 py-2 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
                  pendingConfirm.type === 'delete-drive'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                {driveMutating
                  ? 'Виконання...'
                  : pendingConfirm.type === 'overwrite-drive'
                    ? 'Підтвердити оновлення'
                    : pendingConfirm.type === 'delete-drive'
                      ? 'Видалити з Диска'
                      : 'Синхронізувати'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
