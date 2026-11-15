export type ThemeMode = 'light' | 'dark' | 'system';

export type WorkoutCategory = 'strength' | 'cardio' | 'hiit' | 'mobility';

export type MuscleGroup =
  | 'Груди'
  | 'Спина'
  | 'Ноги'
  | 'Плечі'
  | 'Руки'
  | 'Кор'
  | 'Кардіо'
  | 'Мобільність';

export interface ExerciseDefinition {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  trackingType: 'strength' | 'cardio' | 'duration';
  isCustom?: boolean;
}

export interface WorkoutSet {
  id: string;
  weightKg: number;
  reps: number;
  distanceKm?: number;
  durationSec?: number;
  note?: string;
  completed: boolean;
}

export interface WorkoutExercise {
  id: string;
  exerciseId?: string;
  name: string;
  muscleGroup: MuscleGroup;
  trackingType: 'strength' | 'cardio' | 'duration';
  restSeconds?: number;
  sets: WorkoutSet[];
}

export interface WorkoutSession {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  category: WorkoutCategory;
  durationMinutes: number;
  rpe: number; // 1-10 perceived exertion
  calories?: number;
  notes?: string;
  exercises: WorkoutExercise[];
  completed: boolean;
}

export interface WorkoutTemplate {
  id: string;
  title: string;
  category: WorkoutCategory;
  estimatedMinutes: number;
  description: string;
  exercises: Omit<WorkoutExercise, 'id'>[];
}

export interface WeeklyGoals {
  workoutsPerWeek: number;
  minutesPerWeek: number;
  dailyMinutesTarget: number;
  weeklyVolumeKg: number;
}

export interface BodyProfile {
  heightCm: number;
  weightKg: number;
}

export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Пн ... 6 = Нд

export interface ProgramWeekSchedule {
  weekNumber: number;
  focusNote?: string;
  days: Record<WeekdayIndex, string | null>;
}

export interface TrainingProgram {
  id: string;
  title: string;
  description: string;
  durationWeeks: number;
  startDate?: string; // YYYY-MM-DD (Monday of Week 1)
  isActive: boolean;
  weeks: ProgramWeekSchedule[];
}

export interface ActiveSessionState {
  session: WorkoutSession;
  startedAtMs: number;
  restEndAtMs: number | null;
  restTotalSec: number;
}

export type AiWorkoutGoal =
  | 'fat_loss'
  | 'muscle_gain'
  | 'strength'
  | 'endurance'
  | 'mobility';

export type AiEquipmentId =
  | 'bodyweight'
  | 'dumbbells'
  | 'barbell'
  | 'machines'
  | 'pullup_bar'
  | 'kettlebell'
  | 'bands'
  | 'cardio_machine';

export type AiExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export interface AiPlanRequest {
  goal: AiWorkoutGoal;
  equipment: AiEquipmentId[];
  daysPerWeek: number;
  durationMinutes: number;
  experienceLevel: AiExperienceLevel;
  notes?: string;
}

export interface AiGeneratedDay {
  weekdayIndex: WeekdayIndex;
  isRestDay: boolean;
  restNote?: string;
  template?: WorkoutTemplate;
}

export interface AiGeneratedPlan {
  planTitle: string;
  planSummary: string;
  weeklyTips: string[];
  days: AiGeneratedDay[];
}

export interface UserProfile {
  name: string;
  avatarDataUrl?: string;
  bio?: string;
  deviceName?: string;
  updatedAt: string;
}

export interface CloudBackupPayload {
  version: number;
  updatedAt: string;
  deviceName: string;
  userProfile: UserProfile;
  sessions: WorkoutSession[];
  exercises: ExerciseDefinition[];
  goals: WeeklyGoals;
  bodyProfile: BodyProfile;
  programs: TrainingProgram[];
  customTemplates: WorkoutTemplate[];
  theme: ThemeMode;
}

export interface DriveBackupFileMeta {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string;
}

export interface SyncMergeSummary {
  addedSessions: number;
  updatedSessions: number;
  addedExercises: number;
  addedPrograms: number;
  addedTemplates: number;
  profileUpdated: boolean;
}

export type AiAdviceFocus = 'intensity' | 'volume' | 'recovery' | 'balance';

export interface AiProgressRecommendation {
  title: string;
  focus: AiAdviceFocus;
  action: string;
}

export interface AiProgressAdvice {
  headline: string;
  summary: string;
  recommendations: AiProgressRecommendation[];
  nextSessionFocus: string;
  generatedAt: string;
}

export interface NotificationSettings {
  enabled: boolean;
  inactivityReminderEnabled: boolean;
  inactivityDaysThreshold: number;
  preferredTime: string; // HH:mm
  weightReminderAfterExercise: boolean;
  lastOpenedAtMs: number;
  lastInactivityNotifiedAtMs?: number;
}

