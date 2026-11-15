import {
  TrainingProgram,
  WeekdayIndex,
  WorkoutCategory,
  WorkoutSession,
  WorkoutSet,
  WorkoutTemplate,
} from '../types/workout';

export const CATEGORY_LABELS: Record<WorkoutCategory, string> = {
  strength: 'Силове',
  cardio: 'Кардіо',
  hiit: 'HIIT',
  mobility: 'Мобільність',
};

export const CATEGORY_ACCENTS: Record<WorkoutCategory, string> = {
  strength: 'text-orange-700 dark:text-orange-400',
  cardio: 'text-sky-700 dark:text-sky-400',
  hiit: 'text-rose-700 dark:text-rose-400',
  mobility: 'text-emerald-700 dark:text-emerald-400',
};

export const CATEGORY_BAR_COLORS: Record<WorkoutCategory, string> = {
  strength: 'bg-orange-600',
  cardio: 'bg-sky-600',
  hiit: 'bg-rose-600',
  mobility: 'bg-emerald-600',
};

const UK_WEEKDAYS_SHORT = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const UK_MONTHS_GENITIVE = [
  'січня',
  'лютого',
  'березня',
  'квітня',
  'травня',
  'червня',
  'липня',
  'серпня',
  'вересня',
  'жовтня',
  'листопада',
  'грудня',
];

export function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(dateStr: string, delta: number): string {
  const dt = parseLocalDate(dateStr);
  dt.setDate(dt.getDate() + delta);
  return toLocalDateString(dt);
}

export function getWeekStartMonday(dateStr: string): string {
  const dt = parseLocalDate(dateStr);
  const day = dt.getDay(); // 0 = Sun, 1 = Mon...
  const diff = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  return toLocalDateString(dt);
}

export function getWeekDays(weekStartStr: string): {
  date: string;
  weekdayShort: string;
  dayNumber: number;
}[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStartStr, i);
    const dt = parseLocalDate(date);
    return {
      date,
      weekdayShort: UK_WEEKDAYS_SHORT[dt.getDay()],
      dayNumber: dt.getDate(),
    };
  });
}

export function formatUkDateLong(dateStr: string): string {
  const dt = parseLocalDate(dateStr);
  const weekday = UK_WEEKDAYS_SHORT[dt.getDay()];
  return `${weekday}, ${dt.getDate()} ${UK_MONTHS_GENITIVE[dt.getMonth()]}`;
}

export function formatUkDateShort(dateStr: string): string {
  const dt = parseLocalDate(dateStr);
  return `${dt.getDate()} ${UK_MONTHS_GENITIVE[dt.getMonth()].slice(0, 3)}`;
}

export function formatNumberUk(val: number): string {
  return new Intl.NumberFormat('uk-UA').format(Math.round(val));
}

export function formatClockTimer(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function getSessionVolumeKg(session: WorkoutSession): number {
  let total = 0;
  for (const ex of session.exercises) {
    if (ex.trackingType !== 'strength') continue;
    for (const set of ex.sets) {
      if (set.completed && set.weightKg > 0 && set.reps > 0) {
        total += set.weightKg * set.reps;
      }
    }
  }
  return Math.round(total);
}

export function getSessionDistanceKm(session: WorkoutSession): number {
  let dist = 0;
  for (const ex of session.exercises) {
    if (ex.trackingType !== 'cardio') continue;
    for (const set of ex.sets) {
      if (set.completed && set.distanceKm) {
        dist += set.distanceKm;
      }
    }
  }
  return Math.round(dist * 10) / 10;
}

export function getCompletedSetsCount(session: WorkoutSession): {
  done: number;
  total: number;
} {
  let done = 0;
  let total = 0;
  for (const ex of session.exercises) {
    for (const set of ex.sets) {
      total += 1;
      if (set.completed) done += 1;
    }
  }
  return { done, total };
}

export function estimateSessionCalories(session: WorkoutSession): number {
  if (session.calories && session.calories > 0) return session.calories;
  const perMin: Record<WorkoutCategory, number> = {
    strength: 6.5,
    cardio: 10.2,
    hiit: 11.4,
    mobility: 3.4,
  };
  const rpeFactor = 0.75 + (session.rpe / 10) * 0.45;
  return Math.round(session.durationMinutes * perMin[session.category] * rpeFactor);
}

export function calculateStreakDays(
  sessions: WorkoutSession[],
  referenceDate: string
): number {
  const completedDates = new Set(
    sessions.filter((s) => s.completed).map((s) => s.date)
  );
  if (completedDates.size === 0) return 0;

  let cursor = referenceDate;
  if (!completedDates.has(cursor)) {
    const yesterday = addDays(referenceDate, -1);
    if (completedDates.has(yesterday)) {
      cursor = yesterday;
    } else {
      return 0;
    }
  }

  let streak = 0;
  while (completedDates.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export interface PersonalRecordItem {
  exerciseName: string;
  muscleGroup: string;
  trackingType: 'strength' | 'cardio' | 'duration';
  bestWeightKg: number;
  bestRepsAtMax: number;
  estimated1RmKg: number;
  bestDistanceKm: number;
  bestDurationSec: number;
  achievedDate: string;
}

export function calculateEpley1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return Math.round(weightKg * 10) / 10;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

export function calculateBrzycki1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return Math.round(weightKg * 10) / 10;
  const clampedReps = Math.min(reps, 36);
  return Math.round((weightKg * (36 / (37 - clampedReps))) * 10) / 10;
}

export function calculateLombardi1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return Math.round(weightKg * 10) / 10;
  return Math.round(weightKg * Math.pow(reps, 0.1) * 10) / 10;
}

export type OneRmFormula = 'epley' | 'brzycki' | 'lombardi' | 'average';

export function calculateOneRm(
  weightKg: number,
  reps: number,
  formula: OneRmFormula = 'epley'
): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (formula === 'epley') return calculateEpley1RM(weightKg, reps);
  if (formula === 'brzycki') return calculateBrzycki1RM(weightKg, reps);
  if (formula === 'lombardi') return calculateLombardi1RM(weightKg, reps);
  const avg =
    (calculateEpley1RM(weightKg, reps) +
      calculateBrzycki1RM(weightKg, reps) +
      calculateLombardi1RM(weightKg, reps)) /
    3;
  return Math.round(avg * 10) / 10;
}

export function roundToPlateKg(weightKg: number, step = 2.5): number {
  if (weightKg <= 0) return 0;
  return Math.round(weightKg / step) * step;
}

export function extractPersonalRecords(
  sessions: WorkoutSession[]
): PersonalRecordItem[] {
  const map = new Map<string, PersonalRecordItem>();

  const updateRecord = (
    name: string,
    muscleGroup: string,
    trackingType: 'strength' | 'cardio' | 'duration',
    set: WorkoutSet,
    date: string
  ) => {
    if (!set.completed) return;
    const key = name.trim().toLowerCase();
    const existing = map.get(key);

    if (trackingType === 'strength') {
      const e1rm = calculateEpley1RM(set.weightKg, set.reps);
      if (
        !existing ||
        set.weightKg > existing.bestWeightKg ||
        (set.weightKg === existing.bestWeightKg && e1rm > existing.estimated1RmKg)
      ) {
        map.set(key, {
          exerciseName: name,
          muscleGroup,
          trackingType,
          bestWeightKg: set.weightKg,
          bestRepsAtMax: set.reps,
          estimated1RmKg: e1rm,
          bestDistanceKm: existing?.bestDistanceKm ?? 0,
          bestDurationSec: existing?.bestDurationSec ?? 0,
          achievedDate: date,
        });
      }
    } else if (trackingType === 'cardio') {
      const dist = set.distanceKm ?? 0;
      const dur = set.durationSec ?? 0;
      if (!existing || dist > existing.bestDistanceKm) {
        map.set(key, {
          exerciseName: name,
          muscleGroup,
          trackingType,
          bestWeightKg: 0,
          bestRepsAtMax: 0,
          estimated1RmKg: 0,
          bestDistanceKm: dist,
          bestDurationSec: dur,
          achievedDate: date,
        });
      }
    } else {
      const dur = set.durationSec ?? 0;
      if (!existing || dur > existing.bestDurationSec) {
        map.set(key, {
          exerciseName: name,
          muscleGroup,
          trackingType,
          bestWeightKg: 0,
          bestRepsAtMax: 0,
          estimated1RmKg: 0,
          bestDistanceKm: 0,
          bestDurationSec: dur,
          achievedDate: date,
        });
      }
    }
  };

  for (const session of sessions) {
    if (!session.completed) continue;
    for (const ex of session.exercises) {
      for (const set of ex.sets) {
        updateRecord(ex.name, ex.muscleGroup, ex.trackingType, set, session.date);
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.trackingType === 'strength' && b.trackingType !== 'strength') return -1;
    if (a.trackingType !== 'strength' && b.trackingType === 'strength') return 1;
    return b.estimated1RmKg - a.estimated1RmKg || b.bestDistanceKm - a.bestDistanceKm;
  });
}

export interface HeatmapDay {
  date: string;
  minutes: number;
  volumeKg: number;
  workoutsCount: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export function buildHeatmapDays(
  sessions: WorkoutSession[],
  endDateStr: string,
  totalDays = 35
): HeatmapDay[] {
  const byDate = new Map<string, { minutes: number; volumeKg: number; count: number }>();
  for (const s of sessions) {
    if (!s.completed) continue;
    const prev = byDate.get(s.date) ?? { minutes: 0, volumeKg: 0, count: 0 };
    byDate.set(s.date, {
      minutes: prev.minutes + s.durationMinutes,
      volumeKg: prev.volumeKg + getSessionVolumeKg(s),
      count: prev.count + 1,
    });
  }

  const days: HeatmapDay[] = [];
  for (let offset = -(totalDays - 1); offset <= 0; offset += 1) {
    const date = addDays(endDateStr, offset);
    const data = byDate.get(date);
    const mins = data?.minutes ?? 0;
    let level: 0 | 1 | 2 | 3 | 4 = 0;
    if (mins > 0 && mins < 25) level = 1;
    else if (mins >= 25 && mins < 45) level = 2;
    else if (mins >= 45 && mins < 70) level = 3;
    else if (mins >= 70) level = 4;

    days.push({
      date,
      minutes: mins,
      volumeKg: data?.volumeKg ?? 0,
      workoutsCount: data?.count ?? 0,
      level,
    });
  }
  return days;
}

export interface YearlyHeatmapCell {
  date: string;
  weekIndex: number;
  weekdayIndex: WeekdayIndex;
  inRange: boolean;
  isFuture: boolean;
  minutes: number;
  volumeKg: number;
  workoutsCount: number;
  avgRpe: number;
  intensityLoad: number;
  intensityLevel: 0 | 1 | 2 | 3 | 4;
  frequencyLevel: 0 | 1 | 2 | 3 | 4;
  titles: string[];
}

export interface YearlyHeatmapMonthLabel {
  weekIndex: number;
  label: string;
}

export interface YearlyHeatmapSummary {
  activeDays: number;
  totalRangeDays: number;
  totalWorkouts: number;
  totalMinutes: number;
  avgRpe: number;
  longestStreak: number;
  mostActiveWeekday: string;
}

export interface YearlyHeatmapResult {
  cells: YearlyHeatmapCell[];
  weeksCount: number;
  monthLabels: YearlyHeatmapMonthLabel[];
  summary: YearlyHeatmapSummary;
  rangeStart: string;
  rangeEnd: string;
}

const UK_MONTHS_SHORT = [
  'Січ',
  'Лют',
  'Бер',
  'Кві',
  'Тра',
  'Чер',
  'Лип',
  'Сер',
  'Вер',
  'Жов',
  'Лис',
  'Гру',
];

const UK_WEEKDAYS_FULL_MON = [
  'Понеділок',
  'Вівторок',
  'Середа',
  'Четвер',
  "П'ятниця",
  'Субота',
  'Неділя',
];

export function buildYearlyHeatmap(
  sessions: WorkoutSession[],
  todayDate: string,
  mode: 'rolling' | 'year' = 'rolling',
  targetYear?: number
): YearlyHeatmapResult {
  const byDate = new Map<
    string,
    {
      minutes: number;
      volumeKg: number;
      count: number;
      rpeWeightedSum: number;
      intensityLoad: number;
      titles: string[];
    }
  >();

  for (const s of sessions) {
    if (!s.completed) continue;
    const prev = byDate.get(s.date) ?? {
      minutes: 0,
      volumeKg: 0,
      count: 0,
      rpeWeightedSum: 0,
      intensityLoad: 0,
      titles: [],
    };
    const mins = Math.max(0, s.durationMinutes);
    const load = mins * Math.max(1, s.rpe);
    prev.minutes += mins;
    prev.volumeKg += getSessionVolumeKg(s);
    prev.count += 1;
    prev.rpeWeightedSum += s.rpe * Math.max(1, mins);
    prev.intensityLoad += load;
    prev.titles.push(s.title);
    byDate.set(s.date, prev);
  }

  let rangeStart: string;
  let rangeEnd: string;
  let gridStartMonday: string;
  let gridEndSunday: string;

  if (mode === 'year') {
    const yr = targetYear ?? parseLocalDate(todayDate).getFullYear();
    rangeStart = `${yr}-01-01`;
    rangeEnd = `${yr}-12-31`;
    gridStartMonday = getWeekStartMonday(rangeStart);
    gridEndSunday = addDays(getWeekStartMonday(rangeEnd), 6);
  } else {
    rangeEnd = todayDate;
    rangeStart = addDays(todayDate, -364);
    gridStartMonday = getWeekStartMonday(rangeStart);
    gridEndSunday = addDays(getWeekStartMonday(todayDate), 6);
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const totalGridDays =
    Math.round(
      (parseLocalDate(gridEndSunday).getTime() -
        parseLocalDate(gridStartMonday).getTime()) /
        msPerDay
    ) + 1;
  const weeksCount = Math.ceil(totalGridDays / 7);

  const cells: YearlyHeatmapCell[] = [];
  const monthLabels: YearlyHeatmapMonthLabel[] = [];
  let lastMonthWeek = -3;
  let prevMonthKey = '';

  let activeDays = 0;
  let totalRangeDays = 0;
  let totalWorkouts = 0;
  let totalMinutes = 0;
  let totalRpeWeighted = 0;
  let currentStreak = 0;
  let longestStreak = 0;
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];

  for (let i = 0; i < weeksCount * 7; i += 1) {
    const date = addDays(gridStartMonday, i);
    const weekIndex = Math.floor(i / 7);
    const weekdayIndex = (i % 7) as WeekdayIndex;
    const inRange = date >= rangeStart && date <= rangeEnd;
    const isFuture = date > todayDate;

    const dt = parseLocalDate(date);
    const monthKey = `${dt.getFullYear()}-${dt.getMonth()}`;
    if (inRange && weekdayIndex === 0 && monthKey !== prevMonthKey) {
      if (weekIndex - lastMonthWeek >= 2) {
        monthLabels.push({
          weekIndex,
          label: UK_MONTHS_SHORT[dt.getMonth()],
        });
        lastMonthWeek = weekIndex;
      }
      prevMonthKey = monthKey;
    } else if (inRange && dt.getDate() === 1 && monthKey !== prevMonthKey) {
      if (weekIndex - lastMonthWeek >= 2) {
        monthLabels.push({
          weekIndex,
          label: UK_MONTHS_SHORT[dt.getMonth()],
        });
        lastMonthWeek = weekIndex;
      }
      prevMonthKey = monthKey;
    }

    const dayData = byDate.get(date);
    const minutes = dayData?.minutes ?? 0;
    const workoutsCount = dayData?.count ?? 0;
    const intensityLoad = dayData?.intensityLoad ?? 0;
    const avgRpe =
      dayData && dayData.minutes > 0
        ? Math.round((dayData.rpeWeightedSum / dayData.minutes) * 10) / 10
        : workoutsCount > 0 && dayData
          ? Math.round((dayData.rpeWeightedSum / workoutsCount) * 10) / 10
          : 0;

    let intensityLevel: 0 | 1 | 2 | 3 | 4 = 0;
    if (workoutsCount > 0) {
      if (intensityLoad < 180) intensityLevel = 1;
      else if (intensityLoad < 360) intensityLevel = 2;
      else if (intensityLoad < 540) intensityLevel = 3;
      else intensityLevel = 4;
    }

    let frequencyLevel: 0 | 1 | 2 | 3 | 4 = 0;
    if (workoutsCount > 0) {
      if (workoutsCount >= 2 && minutes >= 70) frequencyLevel = 4;
      else if (workoutsCount >= 2 || minutes >= 60) frequencyLevel = 3;
      else if (minutes >= 32) frequencyLevel = 2;
      else frequencyLevel = 1;
    }

    if (inRange && !isFuture) {
      totalRangeDays += 1;
      if (workoutsCount > 0) {
        activeDays += 1;
        totalWorkouts += workoutsCount;
        totalMinutes += minutes;
        totalRpeWeighted += dayData?.rpeWeightedSum ?? 0;
        weekdayCounts[weekdayIndex] += workoutsCount;
        currentStreak += 1;
        if (currentStreak > longestStreak) longestStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
    }

    cells.push({
      date,
      weekIndex,
      weekdayIndex,
      inRange,
      isFuture,
      minutes,
      volumeKg: dayData?.volumeKg ?? 0,
      workoutsCount,
      avgRpe,
      intensityLoad,
      intensityLevel,
      frequencyLevel,
      titles: dayData?.titles ?? [],
    });
  }

  let bestWdIdx = 0;
  for (let idx = 1; idx < 7; idx += 1) {
    if (weekdayCounts[idx] > weekdayCounts[bestWdIdx]) {
      bestWdIdx = idx;
    }
  }

  const avgRpeOverall =
    totalMinutes > 0
      ? Math.round((totalRpeWeighted / totalMinutes) * 10) / 10
      : 0;

  return {
    cells,
    weeksCount,
    monthLabels,
    summary: {
      activeDays,
      totalRangeDays,
      totalWorkouts,
      totalMinutes,
      avgRpe: avgRpeOverall,
      longestStreak,
      mostActiveWeekday:
        weekdayCounts[bestWdIdx] > 0 ? UK_WEEKDAYS_FULL_MON[bestWdIdx] : '—',
    },
    rangeStart,
    rangeEnd,
  };
}

export interface ExerciseWeightPoint {
  date: string;
  maxWeightKg: number;
  repsAtMax: number;
  estimated1RmKg: number;
  volumeKg: number;
}

export function getLoggedStrengthExercises(sessions: WorkoutSession[]): string[] {
  const counts = new Map<string, { name: string; count: number; latestDate: string }>();

  for (const session of sessions) {
    if (!session.completed) continue;
    for (const ex of session.exercises) {
      if (ex.trackingType !== 'strength') continue;
      const hasValidWeight = ex.sets.some((s) => s.completed && s.weightKg > 0);
      if (!hasValidWeight) continue;

      const key = ex.name.trim().toLowerCase();
      const prev = counts.get(key);
      if (!prev) {
        counts.set(key, { name: ex.name.trim(), count: 1, latestDate: session.date });
      } else {
        counts.set(key, {
          name: prev.name,
          count: prev.count + 1,
          latestDate: session.date > prev.latestDate ? session.date : prev.latestDate,
        });
      }
    }
  }

  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count || b.latestDate.localeCompare(a.latestDate))
    .map((item) => item.name);
}

export function buildExercise30DaySeries(
  sessions: WorkoutSession[],
  exerciseName: string,
  endDateStr: string
): ExerciseWeightPoint[] {
  if (!exerciseName) return [];
  const startDateStr = addDays(endDateStr, -29);
  const targetKey = exerciseName.trim().toLowerCase();
  const byDate = new Map<string, ExerciseWeightPoint>();

  for (const session of sessions) {
    if (!session.completed) continue;
    if (session.date < startDateStr || session.date > endDateStr) continue;

    for (const ex of session.exercises) {
      if (ex.trackingType !== 'strength') continue;
      if (ex.name.trim().toLowerCase() !== targetKey) continue;

      let dayMax = byDate.get(session.date)?.maxWeightKg ?? 0;
      let dayReps = byDate.get(session.date)?.repsAtMax ?? 0;
      let day1Rm = byDate.get(session.date)?.estimated1RmKg ?? 0;
      let dayVol = byDate.get(session.date)?.volumeKg ?? 0;

      for (const set of ex.sets) {
        if (!set.completed || set.weightKg <= 0) continue;
        const set1Rm = calculateEpley1RM(set.weightKg, set.reps);
        if (set.weightKg > dayMax || (set.weightKg === dayMax && set.reps > dayReps)) {
          dayMax = set.weightKg;
          dayReps = set.reps;
        }
        if (set1Rm > day1Rm) {
          day1Rm = set1Rm;
        }
        if (set.reps > 0) {
          dayVol += set.weightKg * set.reps;
        }
      }

      if (dayMax > 0) {
        byDate.set(session.date, {
          date: session.date,
          maxWeightKg: dayMax,
          repsAtMax: dayReps,
          estimated1RmKg: day1Rm,
          volumeKg: Math.round(dayVol),
        });
      }
    }
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// Standard RTS RPE-to-%1RM lookup table for 1..12 reps at RPE 10 down to 6 (step 0.5)
const RTS_RPE_LEVELS = [10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6] as const;
const RTS_PERCENT_TABLE: Record<number, number[]> = {
  10: [100, 95.5, 92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 71.7, 69.5],
  9.5: [97.8, 93.9, 90.7, 87.8, 85.0, 82.4, 79.9, 77.4, 75.1, 72.8, 70.6, 68.5],
  9: [95.5, 92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 71.7, 69.5, 67.4],
  8.5: [93.9, 90.7, 87.8, 85.0, 82.4, 79.9, 77.4, 75.1, 72.8, 70.6, 68.5, 66.4],
  8: [92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 71.7, 69.5, 67.4, 65.3],
  7.5: [90.7, 87.8, 85.0, 82.4, 79.9, 77.4, 75.1, 72.8, 70.6, 68.5, 66.4, 64.4],
  7: [89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 71.7, 69.5, 67.4, 65.3, 63.3],
  6.5: [87.8, 85.0, 82.4, 79.9, 77.4, 75.1, 72.8, 70.6, 68.5, 66.4, 64.4, 62.4],
  6: [86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 71.7, 69.5, 67.4, 65.3, 63.3, 61.3],
};

export function getPercentOf1RmForRepsRpe(reps: number, rpe: number): number {
  const safeReps = Math.max(1, Math.round(reps));
  const safeRpe = Math.min(10, Math.max(5, rpe));

  if (safeReps <= 12 && safeRpe >= 6) {
    // Interpolate along nearest 0.5 step in RTS table
    const lowerRpe = Math.floor(safeRpe * 2) / 2;
    const upperRpe = Math.min(10, Math.ceil(safeRpe * 2) / 2);
    const lowPct = RTS_PERCENT_TABLE[lowerRpe]?.[safeReps - 1] ?? 70;
    const highPct = RTS_PERCENT_TABLE[upperRpe]?.[safeReps - 1] ?? lowPct;
    if (lowerRpe === upperRpe) return lowPct;
    const t = (safeRpe - lowerRpe) / (upperRpe - lowerRpe);
    return Math.round((lowPct + (highPct - lowPct) * t) * 10) / 10;
  }

  const rir = Math.max(0, 10 - safeRpe);
  const effectiveReps = safeReps + rir;
  if (effectiveReps <= 1) return 100;
  return Math.round((100 / (1 + (effectiveReps - 1) / 30)) * 10) / 10;
}

export function calculateExpectedWeightForRpe(
  estimated1RmKg: number,
  targetReps: number,
  targetRpe: number,
  step = 2.5
): { exactKg: number; plateKg: number; percent1Rm: number } {
  if (estimated1RmKg <= 0) {
    return { exactKg: 0, plateKg: 0, percent1Rm: 0 };
  }
  const percent1Rm = getPercentOf1RmForRepsRpe(targetReps, targetRpe);
  const exactKg = Math.round(((estimated1RmKg * percent1Rm) / 100) * 10) / 10;
  const plateKg = roundToPlateKg(exactKg, step);
  return { exactKg, plateKg, percent1Rm };
}

export interface RpeEstimationResult {
  rpe: number;
  rir: number;
  percent1Rm: number;
  label: string;
}

export function getRpeDescription(rpe: number): string {
  if (rpe >= 9.5) return 'Майже межа / без запасу';
  if (rpe >= 8.5) return 'Важко · 1–2 повтори в запасі';
  if (rpe >= 7.5) return 'Оптимально · 2–3 повтори в запасі';
  if (rpe >= 6.5) return 'Помірно · 3–4 повтори в запасі';
  return 'Легко / розминка · 4+ повторів у запасі';
}

export function estimateRpeFromSet(
  weightKg: number,
  reps: number,
  estimated1RmKg: number
): RpeEstimationResult {
  if (weightKg <= 0 || reps <= 0 || estimated1RmKg <= 0) {
    return {
      rpe: 7,
      rir: 3,
      percent1Rm: 0,
      label: getRpeDescription(7),
    };
  }

  const percent1Rm = Math.round(((weightKg / estimated1RmKg) * 100) * 10) / 10;
  const safeReps = Math.max(1, Math.round(reps));

  if (safeReps <= 12) {
    const col = RTS_RPE_LEVELS.map((lvl) => ({
      rpe: lvl,
      pct: RTS_PERCENT_TABLE[lvl][safeReps - 1],
    }));

    if (percent1Rm >= col[0].pct) {
      return { rpe: 10, rir: 0, percent1Rm, label: getRpeDescription(10) };
    }

    for (let i = 0; i < col.length - 1; i += 1) {
      const upper = col[i];
      const lower = col[i + 1];
      if (percent1Rm <= upper.pct && percent1Rm >= lower.pct) {
        const ratio = (percent1Rm - lower.pct) / (upper.pct - lower.pct);
        const rawRpe = lower.rpe + ratio * 0.5;
        const roundedRpe = Math.round(rawRpe * 2) / 2;
        return {
          rpe: roundedRpe,
          rir: Math.max(0, Math.round((10 - roundedRpe) * 10) / 10),
          percent1Rm,
          label: getRpeDescription(roundedRpe),
        };
      }
    }
  }

  // Fallback for >12 reps or <60% 1RM via Epley inverse
  const impliedMaxReps = (estimated1RmKg / weightKg - 1) * 30;
  const rir = Math.max(0, Math.min(8, impliedMaxReps - safeReps));
  const rawRpe = Math.max(5, Math.min(10, 10 - rir));
  const roundedRpe = Math.round(rawRpe * 2) / 2;
  return {
    rpe: roundedRpe,
    rir: Math.round((10 - roundedRpe) * 10) / 10,
    percent1Rm,
    label: getRpeDescription(roundedRpe),
  };
}

export interface ExerciseHistoryPrediction {
  exerciseName: string;
  lastDate: string;
  lastRpe: number;
  historicalBest1RmKg: number;
  lastBestWeightKg: number;
  lastBestReps: number;
  expectedSets: WorkoutSet[];
  progressionNote: string;
}

export function getExerciseHistoryPrediction(
  sessions: WorkoutSession[],
  exerciseName: string,
  excludeSessionId?: string
): ExerciseHistoryPrediction | null {
  const targetKey = exerciseName.trim().toLowerCase();
  if (!targetKey) return null;

  const sortedCompleted = sessions
    .filter((s) => s.completed && s.id !== excludeSessionId)
    .sort((a, b) => b.date.localeCompare(a.date));

  let best1Rm = 0;
  let lastSessionMatch: {
    date: string;
    rpe: number;
    sets: WorkoutSet[];
    trackingType: 'strength' | 'cardio' | 'duration';
  } | null = null;

  for (const session of sortedCompleted) {
    for (const ex of session.exercises) {
      if (ex.name.trim().toLowerCase() !== targetKey) continue;

      for (const s of ex.sets) {
        if (ex.trackingType === 'strength' && s.completed && s.weightKg > 0 && s.reps > 0) {
          const e1rm = calculateEpley1RM(s.weightKg, s.reps);
          if (e1rm > best1Rm) best1Rm = e1rm;
        }
      }

      if (!lastSessionMatch && ex.sets.length > 0) {
        lastSessionMatch = {
          date: session.date,
          rpe: session.rpe,
          sets: ex.sets,
          trackingType: ex.trackingType,
        };
      }
    }
  }

  if (!lastSessionMatch) return null;

  const shouldProgress =
    lastSessionMatch.trackingType === 'strength' && lastSessionMatch.rpe <= 7;
  const increment = shouldProgress ? 2.5 : 0;

  let lastBestWeight = 0;
  let lastBestReps = 0;
  for (const s of lastSessionMatch.sets) {
    if (s.weightKg > lastBestWeight || (s.weightKg === lastBestWeight && s.reps > lastBestReps)) {
      lastBestWeight = s.weightKg;
      lastBestReps = s.reps;
    }
  }

  const expectedSets: WorkoutSet[] = lastSessionMatch.sets.map((s, idx) => ({
    id: `s-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
    weightKg:
      lastSessionMatch!.trackingType === 'strength' && s.weightKg > 0
        ? Math.round((s.weightKg + increment) * 10) / 10
        : s.weightKg,
    reps: s.reps,
    distanceKm: s.distanceKm,
    durationSec: s.durationSec,
    completed: true,
  }));

  const progressionNote =
    lastSessionMatch.trackingType === 'strength'
      ? shouldProgress
        ? `Очікується прогресія +2.5 кг (минулий RPE ${lastSessionMatch.rpe}/10)`
        : `Базується на попередньому тренуванні (RPE ${lastSessionMatch.rpe}/10)`
      : `Заповнено за попереднім записом (${formatUkDateShort(lastSessionMatch.date)})`;

  return {
    exerciseName,
    lastDate: lastSessionMatch.date,
    lastRpe: lastSessionMatch.rpe,
    historicalBest1RmKg: best1Rm,
    lastBestWeightKg: lastBestWeight,
    lastBestReps: lastBestReps,
    expectedSets,
    progressionNote,
  };
}

export function estimateSessionRpe(
  currentExercises: { name: string; trackingType: string; sets: WorkoutSet[] }[],
  historySessions: WorkoutSession[],
  excludeSessionId?: string
): { rpe: number; matchedCount: number } | null {
  const impliedValues: number[] = [];

  for (const ex of currentExercises) {
    if (ex.trackingType !== 'strength') continue;
    const pred = getExerciseHistoryPrediction(
      historySessions,
      ex.name,
      excludeSessionId
    );
    const ref1Rm =
      pred?.historicalBest1RmKg ||
      Math.max(0, ...ex.sets.map((s) => calculateEpley1RM(s.weightKg, s.reps)));
    if (ref1Rm <= 0) continue;

    for (const s of ex.sets) {
      if (s.weightKg > 0 && s.reps > 0) {
        const res = estimateRpeFromSet(s.weightKg, s.reps, ref1Rm);
        impliedValues.push(res.rpe);
      }
    }
  }

  if (impliedValues.length === 0) return null;
  // Use top 60% hardest sets so warm-up sets don't drag session RPE too low
  const sortedDesc = [...impliedValues].sort((a, b) => b - a);
  const topSlice = sortedDesc.slice(0, Math.max(1, Math.ceil(sortedDesc.length * 0.6)));
  const avg = topSlice.reduce((a, b) => a + b, 0) / topSlice.length;
  return {
    rpe: Math.min(10, Math.max(1, Math.round(avg))),
    matchedCount: impliedValues.length,
  };
}

export type AnatomicalMuscleGroup =
  | 'Груди'
  | 'Спина'
  | 'Ноги'
  | 'Плечі'
  | 'Руки'
  | 'Кор';

export interface MonthlyMuscleStat {
  muscleGroup: string;
  setsCount: number;
  sessionsCount: number;
  volumeKg: number;
  topExercises: string[];
  levelBySets: 0 | 1 | 2 | 3 | 4;
  levelByVolume: 0 | 1 | 2 | 3 | 4;
}

export const ANATOMICAL_MUSCLE_GROUPS: AnatomicalMuscleGroup[] = [
  'Груди',
  'Спина',
  'Ноги',
  'Плечі',
  'Руки',
  'Кор',
];

export function buildMonthlyMuscleLoad(
  sessions: WorkoutSession[],
  endDateStr: string,
  days = 30
): MonthlyMuscleStat[] {
  const startDateStr = addDays(endDateStr, -(days - 1));
  const map = new Map<
    string,
    {
      setsCount: number;
      sessionIds: Set<string>;
      volumeKg: number;
      exerciseCounts: Map<string, number>;
    }
  >();

  for (const mg of ANATOMICAL_MUSCLE_GROUPS) {
    map.set(mg, {
      setsCount: 0,
      sessionIds: new Set(),
      volumeKg: 0,
      exerciseCounts: new Map(),
    });
  }

  for (const session of sessions) {
    if (!session.completed) continue;
    if (session.date < startDateStr || session.date > endDateStr) continue;

    for (const ex of session.exercises) {
      const completedSets = ex.sets.filter((s) => s.completed);
      if (completedSets.length === 0) continue;

      const entry = map.get(ex.muscleGroup) ?? {
        setsCount: 0,
        sessionIds: new Set<string>(),
        volumeKg: 0,
        exerciseCounts: new Map<string, number>(),
      };

      entry.setsCount += completedSets.length;
      entry.sessionIds.add(session.id);
      entry.exerciseCounts.set(
        ex.name,
        (entry.exerciseCounts.get(ex.name) ?? 0) + completedSets.length
      );

      if (ex.trackingType === 'strength') {
        for (const s of completedSets) {
          if (s.weightKg > 0 && s.reps > 0) {
            entry.volumeKg += s.weightKg * s.reps;
          }
        }
      }

      map.set(ex.muscleGroup, entry);
    }
  }

  const maxSets = Math.max(
    1,
    ...Array.from(map.values()).map((v) => v.setsCount)
  );
  const maxVolume = Math.max(
    1,
    ...Array.from(map.values()).map((v) => v.volumeKg)
  );

  const toLevel = (val: number, maxVal: number): 0 | 1 | 2 | 3 | 4 => {
    if (val <= 0) return 0;
    const ratio = val / maxVal;
    if (ratio >= 0.75) return 4;
    if (ratio >= 0.45) return 3;
    if (ratio >= 0.2) return 2;
    return 1;
  };

  return Array.from(map.entries())
    .map(([muscleGroup, data]) => {
      const topExercises = Array.from(data.exerciseCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name);

      const vol = Math.round(data.volumeKg);
      return {
        muscleGroup,
        setsCount: data.setsCount,
        sessionsCount: data.sessionIds.size,
        volumeKg: vol,
        topExercises,
        levelBySets: toLevel(data.setsCount, maxSets),
        levelByVolume: toLevel(vol, maxVolume),
      };
    })
    .sort(
      (a, b) =>
        b.setsCount - a.setsCount ||
        b.volumeKg - a.volumeKg ||
        a.muscleGroup.localeCompare(b.muscleGroup)
    );
}

export const PROGRAM_WEEKDAYS: { index: WeekdayIndex; short: string; full: string }[] = [
  { index: 0, short: 'Пн', full: 'Понеділок' },
  { index: 1, short: 'Вт', full: 'Вівторок' },
  { index: 2, short: 'Ср', full: 'Середа' },
  { index: 3, short: 'Чт', full: 'Четвер' },
  { index: 4, short: 'Пт', full: "П'ятниця" },
  { index: 5, short: 'Сб', full: 'Субота' },
  { index: 6, short: 'Нд', full: 'Неділя' },
];

export function getWeekdayIndexMondayFirst(dateStr: string): WeekdayIndex {
  const dt = parseLocalDate(dateStr);
  const jsDay = dt.getDay(); // 0 = Sun, 1 = Mon...
  return (jsDay === 0 ? 6 : jsDay - 1) as WeekdayIndex;
}

export interface ScheduledProgramDay {
  program: TrainingProgram;
  weekNumber: number;
  focusNote?: string;
  weekdayIndex: WeekdayIndex;
  template: WorkoutTemplate | null;
}

export function getScheduledProgramDay(
  program: TrainingProgram | undefined,
  dateStr: string,
  templates: WorkoutTemplate[]
): ScheduledProgramDay | null {
  if (!program || !program.isActive || program.weeks.length === 0) return null;

  const startMonday = program.startDate
    ? getWeekStartMonday(program.startDate)
    : getWeekStartMonday(dateStr);
  const targetMonday = getWeekStartMonday(dateStr);

  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.round(
    (parseLocalDate(targetMonday).getTime() - parseLocalDate(startMonday).getTime()) /
      msPerDay
  );
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffWeeks < 0 || diffWeeks >= program.weeks.length) {
    return null;
  }

  const week = program.weeks[diffWeeks];
  const weekdayIndex = getWeekdayIndexMondayFirst(dateStr);
  const templateId = week.days[weekdayIndex];
  const template = templateId
    ? templates.find((t) => t.id === templateId) ?? null
    : null;

  return {
    program,
    weekNumber: week.weekNumber,
    focusNote: week.focusNote,
    weekdayIndex,
    template,
  };
}




