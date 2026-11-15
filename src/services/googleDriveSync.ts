import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import type {
  CloudBackupPayload,
  DriveBackupFileMeta,
  ExerciseDefinition,
  SyncMergeSummary,
  TrainingProgram,
  WorkoutSession,
  WorkoutTemplate,
} from '../types/workout';

const SCOPES = ['https://www.googleapis.com/auth/drive.file'] as const;
export const DRIVE_BACKUP_FILENAME = 'temp-workout-backup.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

// Access token is stored strictly in memory — never in localStorage or sessionStorage.
let cachedAccessToken: string | null = null;

export class DriveAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DriveAuthError';
  }
}

export function initAuth(onUserChange: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      cachedAccessToken = null;
    }
    onUserChange(user);
  });
}

export async function googleSignIn(): Promise<{ user: User; accessToken: string }> {
  const provider = new GoogleAuthProvider();
  for (const scope of SCOPES) {
    provider.addScope(scope);
  }
  provider.setCustomParameters({ prompt: 'select_account' });

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const token = credential?.accessToken ?? null;

  if (!token) {
    throw new Error(
      'Не вдалося отримати доступ до Google Диска. Спробуйте увійти повторно та надати дозвіл.'
    );
  }

  cachedAccessToken = token;
  return { user: result.user, accessToken: token };
}

export function getAccessToken(): string | null {
  return cachedAccessToken;
}

export async function logout(): Promise<void> {
  cachedAccessToken = null;
  await signOut(auth);
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: { message?: string } };
    if (data?.error?.message) {
      return data.error.message;
    }
  } catch {
    // Ignore non-JSON error responses
  }
  return `HTTP ${res.status}`;
}

async function driveFetch(url: string, accessToken: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });

  if (res.status === 401) {
    cachedAccessToken = null;
    throw new DriveAuthError(
      'Термін дії сесії Google Диска минув. Увійдіть повторно, щоб продовжити.'
    );
  }

  if (res.status === 403) {
    const detail = await parseErrorMessage(res);
    throw new DriveAuthError(
      `Недостатньо прав доступу до Google Диска (${detail}). Увійдіть повторно та підтвердіть дозвіл.`
    );
  }

  if (!res.ok) {
    const detail = await parseErrorMessage(res);
    throw new Error(`Помилка Google Диска: ${detail}`);
  }

  return res;
}

export async function findDriveBackupFile(
  accessToken: string
): Promise<DriveBackupFileMeta | null> {
  const q = encodeURIComponent(`name = '${DRIVE_BACKUP_FILENAME}' and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&orderBy=modifiedTime%20desc&pageSize=1&fields=files(id,name,modifiedTime,size)`;
  const res = await driveFetch(url, accessToken);
  const data = (await res.json()) as { files?: DriveBackupFileMeta[] };
  return data.files?.[0] ?? null;
}

export async function downloadDriveBackup(
  accessToken: string,
  fileId: string
): Promise<CloudBackupPayload> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
  const res = await driveFetch(url, accessToken);
  const data = (await res.json()) as Partial<CloudBackupPayload>;

  if (!data || !Array.isArray(data.sessions)) {
    throw new Error('Файл резервної копії на Google Диску має невірний формат.');
  }

  return data as CloudBackupPayload;
}

function buildMultipartBody(
  metadata: Record<string, string>,
  payload: CloudBackupPayload
): { body: string; contentType: string } {
  const boundary = `temp_backup_boundary_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(payload, null, 2)}\r\n` +
    `--${boundary}--`;

  return {
    body,
    contentType: `multipart/related; boundary=${boundary}`,
  };
}

export async function createDriveBackup(
  accessToken: string,
  payload: CloudBackupPayload
): Promise<DriveBackupFileMeta> {
  const metadata = {
    name: DRIVE_BACKUP_FILENAME,
    mimeType: 'application/json',
    description: 'Темп — резервна копія профілю, тренувань і програм',
  };
  const { body, contentType } = buildMultipartBody(metadata, payload);
  const url =
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,size';

  const res = await driveFetch(url, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body,
  });

  return (await res.json()) as DriveBackupFileMeta;
}

export async function updateDriveBackup(
  accessToken: string,
  fileId: string,
  payload: CloudBackupPayload
): Promise<DriveBackupFileMeta> {
  const metadata = {
    name: DRIVE_BACKUP_FILENAME,
    mimeType: 'application/json',
  };
  const { body, contentType } = buildMultipartBody(metadata, payload);
  const url = `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(
    fileId
  )}?uploadType=multipart&fields=id,name,modifiedTime,size`;

  const res = await driveFetch(url, accessToken, {
    method: 'PATCH',
    headers: { 'Content-Type': contentType },
    body,
  });

  return (await res.json()) as DriveBackupFileMeta;
}

export async function deleteDriveBackup(
  accessToken: string,
  fileId: string
): Promise<void> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`;
  await driveFetch(url, accessToken, { method: 'DELETE' });
}

function sessionCompletenessScore(session: WorkoutSession): number {
  let score = session.completed ? 10 : 0;
  score += session.exercises.length * 3;
  for (const ex of session.exercises) {
    for (const s of ex.sets) {
      score += s.completed ? 2 : 1;
      if (s.note?.trim()) score += 1;
    }
  }
  if (session.notes?.trim()) score += 2;
  return score;
}

function mergeById<T extends { id: string }>(
  localItems: T[],
  remoteItems: T[],
  pickPreferred?: (localItem: T, remoteItem: T) => T
): { merged: T[]; addedCount: number; updatedCount: number } {
  const map = new Map<string, T>();
  for (const item of localItems) {
    map.set(item.id, item);
  }

  let addedCount = 0;
  let updatedCount = 0;

  for (const remoteItem of remoteItems) {
    const existing = map.get(remoteItem.id);
    if (!existing) {
      map.set(remoteItem.id, remoteItem);
      addedCount += 1;
    } else if (pickPreferred) {
      const winner = pickPreferred(existing, remoteItem);
      if (winner !== existing) {
        map.set(remoteItem.id, winner);
        updatedCount += 1;
      }
    }
  }

  return { merged: Array.from(map.values()), addedCount, updatedCount };
}

export function mergeCloudBackup(
  local: CloudBackupPayload,
  remote: CloudBackupPayload
): { merged: CloudBackupPayload; summary: SyncMergeSummary } {
  const sessionMerge = mergeById<WorkoutSession>(
    local.sessions,
    remote.sessions ?? [],
    (loc, rem) =>
      sessionCompletenessScore(rem) > sessionCompletenessScore(loc) ? rem : loc
  );

  // Sort merged sessions newest date first
  sessionMerge.merged.sort((a, b) => {
    const cmp = b.date.localeCompare(a.date);
    if (cmp !== 0) return cmp;
    return (b.startTime ?? '').localeCompare(a.startTime ?? '');
  });

  const exerciseMerge = mergeById<ExerciseDefinition>(
    local.exercises,
    remote.exercises ?? []
  );

  const programMerge = mergeById<TrainingProgram>(
    local.programs,
    remote.programs ?? []
  );

  // Keep at most one active program
  let seenActive = false;
  const normalizedPrograms = programMerge.merged.map((p) => {
    if (p.isActive && !seenActive) {
      seenActive = true;
      return p;
    }
    return { ...p, isActive: false };
  });

  const templateMerge = mergeById<WorkoutTemplate>(
    local.customTemplates,
    remote.customTemplates ?? []
  );

  const localUpdatedMs = Date.parse(local.userProfile?.updatedAt ?? '') || 0;
  const remoteUpdatedMs = Date.parse(remote.userProfile?.updatedAt ?? '') || 0;
  const remoteIsNewer = remoteUpdatedMs > localUpdatedMs;

  const nextName =
    local.userProfile.name.trim() && !remoteIsNewer
      ? local.userProfile.name
      : remote.userProfile?.name?.trim() || local.userProfile.name;

  const nextAvatar =
    local.userProfile.avatarDataUrl && !remoteIsNewer
      ? local.userProfile.avatarDataUrl
      : remote.userProfile?.avatarDataUrl || local.userProfile.avatarDataUrl;

  const nextBio =
    local.userProfile.bio?.trim() && !remoteIsNewer
      ? local.userProfile.bio
      : remote.userProfile?.bio?.trim() || local.userProfile.bio;

  const profileUpdated =
    nextName !== local.userProfile.name ||
    nextAvatar !== local.userProfile.avatarDataUrl ||
    nextBio !== local.userProfile.bio;

  const merged: CloudBackupPayload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    deviceName: local.deviceName,
    userProfile: {
      name: nextName,
      avatarDataUrl: nextAvatar,
      bio: nextBio,
      deviceName: local.deviceName,
      updatedAt: new Date().toISOString(),
    },
    sessions: sessionMerge.merged,
    exercises: exerciseMerge.merged,
    goals: remoteIsNewer && remote.goals ? remote.goals : local.goals,
    bodyProfile:
      remoteIsNewer && remote.bodyProfile ? remote.bodyProfile : local.bodyProfile,
    programs: normalizedPrograms,
    customTemplates: templateMerge.merged,
    theme: local.theme,
  };

  return {
    merged,
    summary: {
      addedSessions: sessionMerge.addedCount,
      updatedSessions: sessionMerge.updatedCount,
      addedExercises: exerciseMerge.addedCount,
      addedPrograms: programMerge.addedCount,
      addedTemplates: templateMerge.addedCount,
      profileUpdated,
    },
  };
}

export async function resizeProfileImageToDataUrl(
  file: File,
  maxSize = 256
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Будь ласка, оберіть файл зображення (PNG, JPG або WebP).');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Не вдалося завантажити вибране зображення.'));
      el.src = objectUrl;
    });

    const side = Math.min(img.width, img.height);
    const sx = Math.max(0, (img.width - side) / 2);
    const sy = Math.max(0, (img.height - side) / 2);
    const target = Math.min(maxSize, side);

    const canvas = document.createElement('canvas');
    canvas.width = target;
    canvas.height = target;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Не вдалося обробити зображення.');
    }
    ctx.drawImage(img, sx, sy, side, side, 0, 0, target, target);

    const webp = canvas.toDataURL('image/webp', 0.85);
    if (webp.startsWith('data:image/webp')) {
      return webp;
    }
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function detectDefaultDeviceName(): string {
  if (typeof navigator === 'undefined') return 'Веб-браузер';
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return 'Android пристрій';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'Mac комп’ютер';
  if (/Windows/i.test(ua)) return 'Windows ПК';
  if (/Linux/i.test(ua)) return 'Linux ПК';
  return 'Веб-браузер';
}

export function getUserInitials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return 'Т';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function formatBackupSize(sizeStr?: string): string {
  const bytes = Number(sizeStr);
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} МБ`;
}
