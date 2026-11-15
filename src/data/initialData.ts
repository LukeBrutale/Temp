import {
  BodyProfile,
  ExerciseDefinition,
  TrainingProgram,
  WeeklyGoals,
  WorkoutSession,
} from '../types/workout';
import { addDays, getWeekStartMonday, toLocalDateString } from '../utils/workoutStats';
import { WORKOUT_TEMPLATES } from './templates';

export { WORKOUT_TEMPLATES };

export const DEFAULT_GOALS: WeeklyGoals = {
  workoutsPerWeek: 5,
  minutesPerWeek: 240,
  dailyMinutesTarget: 45,
  weeklyVolumeKg: 18000,
};

export const DEFAULT_BODY_PROFILE: BodyProfile = {
  heightCm: 178,
  weightKg: 76,
};

export const INITIAL_EXERCISES: ExerciseDefinition[] = [
  { id: 'ex-bench', name: 'Жим штанги лежачи', muscleGroup: 'Груди', trackingType: 'strength' },
  { id: 'ex-incline-db', name: 'Жим гантелей на похилій лаві', muscleGroup: 'Груди', trackingType: 'strength' },
  { id: 'ex-dips', name: 'Віджимання на брусах', muscleGroup: 'Груди', trackingType: 'strength' },
  { id: 'ex-pullups', name: 'Підтягування широким хватом', muscleGroup: 'Спина', trackingType: 'strength' },
  { id: 'ex-bb-row', name: 'Тяга штанги в нахилі', muscleGroup: 'Спина', trackingType: 'strength' },
  { id: 'ex-lat-pulldown', name: 'Тяга верхнього блоку', muscleGroup: 'Спина', trackingType: 'strength' },
  { id: 'ex-deadlift', name: 'Станова тяга', muscleGroup: 'Спина', trackingType: 'strength' },
  { id: 'ex-squat', name: 'Присідання зі штангою', muscleGroup: 'Ноги', trackingType: 'strength' },
  { id: 'ex-rdl', name: 'Румунська тяга з гантелями', muscleGroup: 'Ноги', trackingType: 'strength' },
  { id: 'ex-leg-press', name: 'Жим ногами в тренажері', muscleGroup: 'Ноги', trackingType: 'strength' },
  { id: 'ex-lunges', name: 'Випади з гантелями', muscleGroup: 'Ноги', trackingType: 'strength' },
  { id: 'ex-ohp', name: 'Армійський жим стоячи', muscleGroup: 'Плечі', trackingType: 'strength' },
  { id: 'ex-lateral-raise', name: 'Махи гантелями в сторони', muscleGroup: 'Плечі', trackingType: 'strength' },
  { id: 'ex-bicep-curl', name: 'Підйом штанги на біцепс', muscleGroup: 'Руки', trackingType: 'strength' },
  { id: 'ex-tricep-pushdown', name: 'Розгинання рук на блоці', muscleGroup: 'Руки', trackingType: 'strength' },
  { id: 'ex-plank', name: 'Планка на передпліччях', muscleGroup: 'Кор', trackingType: 'duration' },
  { id: 'ex-hanging-raise', name: 'Підйом ніг у висі', muscleGroup: 'Кор', trackingType: 'strength' },
  { id: 'ex-run', name: 'Біг на вулиці / доріжці', muscleGroup: 'Кардіо', trackingType: 'cardio' },
  { id: 'ex-row-erg', name: 'Гребний тренажер', muscleGroup: 'Кардіо', trackingType: 'cardio' },
  { id: 'ex-cycling', name: 'Велотренажер / шосе', muscleGroup: 'Кардіо', trackingType: 'cardio' },
  { id: 'ex-burpees', name: 'Берпі інтервали', muscleGroup: 'Кардіо', trackingType: 'duration' },
  { id: 'ex-hip-mobility', name: 'Мобільність кульшових суглобів', muscleGroup: 'Мобільність', trackingType: 'duration' },
  { id: 'ex-thoracic-stretch', name: 'Розкриття грудного відділу', muscleGroup: 'Мобільність', trackingType: 'duration' },
];

export function createInitialPrograms(todayOverride?: string): TrainingProgram[] {
  const today = todayOverride ?? toLocalDateString(new Date());
  const currentWeekMonday = getWeekStartMonday(today);

  return [
    {
      id: 'prog-balance-4w',
      title: '4-тижневий баланс: сила + кардіо',
      description:
        'Послідовний цикл із 4 тижнів, що поєднує силову базу, темповий біг та відновлювальну мобільність.',
      durationWeeks: 4,
      startDate: currentWeekMonday,
      isActive: true,
      weeks: [
        {
          weekNumber: 1,
          focusNote: 'Вхідний тиждень і техніка',
          days: {
            0: 'tpl-push',
            1: 'tpl-run5k',
            2: 'tpl-mobility',
            3: 'tpl-legs',
            4: null,
            5: 'tpl-hiit',
            6: null,
          },
        },
        {
          weekNumber: 2,
          focusNote: 'Нарощування робочого об’єму',
          days: {
            0: 'tpl-push',
            1: 'tpl-run5k',
            2: 'tpl-legs',
            3: 'tpl-mobility',
            4: 'tpl-push',
            5: 'tpl-hiit',
            6: null,
          },
        },
        {
          weekNumber: 3,
          focusNote: 'Піковий тиждень інтенсивності',
          days: {
            0: 'tpl-legs',
            1: 'tpl-hiit',
            2: 'tpl-push',
            3: 'tpl-run5k',
            4: 'tpl-legs',
            5: 'tpl-mobility',
            6: null,
          },
        },
        {
          weekNumber: 4,
          focusNote: 'Розвантаження та відновлення',
          days: {
            0: 'tpl-push',
            1: 'tpl-mobility',
            2: 'tpl-run5k',
            3: null,
            4: 'tpl-legs',
            5: 'tpl-mobility',
            6: null,
          },
        },
      ],
    },
    {
      id: 'prog-strength-3w',
      title: '3-тижневий силовий фокус',
      description:
        'Акцент на жимові вправи, присідання та відновлення суглобів 4 дні на тиждень.',
      durationWeeks: 3,
      isActive: false,
      weeks: [
        {
          weekNumber: 1,
          focusNote: 'Базова сила',
          days: {
            0: 'tpl-push',
            1: 'tpl-legs',
            2: null,
            3: 'tpl-push',
            4: 'tpl-legs',
            5: 'tpl-mobility',
            6: null,
          },
        },
        {
          weekNumber: 2,
          focusNote: 'Прогресія ваги',
          days: {
            0: 'tpl-push',
            1: 'tpl-legs',
            2: 'tpl-mobility',
            3: 'tpl-push',
            4: 'tpl-legs',
            5: null,
            6: null,
          },
        },
        {
          weekNumber: 3,
          focusNote: 'Закріплення максимуму',
          days: {
            0: 'tpl-legs',
            1: 'tpl-push',
            2: null,
            3: 'tpl-legs',
            4: 'tpl-push',
            5: 'tpl-mobility',
            6: null,
          },
        },
      ],
    },
  ];
}

export function createSeedWorkouts(todayOverride?: string): WorkoutSession[] {
  const today = todayOverride ?? toLocalDateString(new Date());

  return [
    {
      id: 'w-today-1',
      title: 'Ранковий жим та плечі',
      date: today,
      startTime: '08:15',
      category: 'strength',
      durationMinutes: 52,
      rpe: 8,
      notes: 'Стабільна техніка на 80 кг, наступного тижня спробувати 82.5 кг.',
      completed: true,
      exercises: [
        {
          id: 'we-1',
          exerciseId: 'ex-bench',
          name: 'Жим штанги лежачи',
          muscleGroup: 'Груди',
          trackingType: 'strength',
          sets: [
            { id: 's1', weightKg: 70, reps: 8, completed: true },
            { id: 's2', weightKg: 80, reps: 6, completed: true },
            { id: 's3', weightKg: 80, reps: 6, completed: true },
            { id: 's4', weightKg: 82.5, reps: 5, completed: true },
          ],
        },
        {
          id: 'we-2',
          exerciseId: 'ex-incline-db',
          name: 'Жим гантелей на похилій лаві',
          muscleGroup: 'Груди',
          trackingType: 'strength',
          sets: [
            { id: 's5', weightKg: 28, reps: 10, completed: true },
            { id: 's6', weightKg: 28, reps: 10, completed: true },
            { id: 's7', weightKg: 28, reps: 9, completed: true },
          ],
        },
        {
          id: 'we-3',
          exerciseId: 'ex-ohp',
          name: 'Армійський жим стоячи',
          muscleGroup: 'Плечі',
          trackingType: 'strength',
          sets: [
            { id: 's8', weightKg: 45, reps: 8, completed: true },
            { id: 's9', weightKg: 47.5, reps: 6, completed: true },
            { id: 's10', weightKg: 47.5, reps: 6, completed: true },
          ],
        },
      ],
    },
    {
      id: 'w-prev-1',
      title: 'Вечірня пробіжка по набережній',
      date: addDays(today, -1),
      startTime: '18:40',
      category: 'cardio',
      durationMinutes: 34,
      rpe: 7,
      notes: 'Легкий зустрічний вітер, середній темп 5:22/км.',
      completed: true,
      exercises: [
        {
          id: 'we-4',
          exerciseId: 'ex-run',
          name: 'Біг на вулиці / доріжці',
          muscleGroup: 'Кардіо',
          trackingType: 'cardio',
          sets: [
            {
              id: 's11',
              weightKg: 0,
              reps: 1,
              distanceKm: 6.3,
              durationSec: 2040,
              completed: true,
            },
          ],
        },
      ],
    },
    {
      id: 'w-prev-2',
      title: 'День ніг: присідання та тяга',
      date: addDays(today, -2),
      startTime: '07:50',
      category: 'strength',
      durationMinutes: 64,
      rpe: 9,
      notes: 'Новий робочий максимум у присіданнях, гарна глибина.',
      completed: true,
      exercises: [
        {
          id: 'we-5',
          exerciseId: 'ex-squat',
          name: 'Присідання зі штангою',
          muscleGroup: 'Ноги',
          trackingType: 'strength',
          sets: [
            { id: 's12', weightKg: 90, reps: 8, completed: true },
            { id: 's13', weightKg: 105, reps: 5, completed: true },
            { id: 's14', weightKg: 110, reps: 4, completed: true },
            { id: 's15', weightKg: 110, reps: 4, completed: true },
          ],
        },
        {
          id: 'we-6',
          exerciseId: 'ex-rdl',
          name: 'Румунська тяга з гантелями',
          muscleGroup: 'Ноги',
          trackingType: 'strength',
          sets: [
            { id: 's16', weightKg: 48, reps: 10, completed: true },
            { id: 's17', weightKg: 52, reps: 10, completed: true },
            { id: 's18', weightKg: 52, reps: 10, completed: true },
          ],
        },
      ],
    },
    {
      id: 'w-prev-3',
      title: 'Мобільність та розтяжка',
      date: addDays(today, -3),
      startTime: '20:10',
      category: 'mobility',
      durationMinutes: 22,
      rpe: 4,
      notes: 'Відновлення після важких ніг.',
      completed: true,
      exercises: [
        {
          id: 'we-7',
          exerciseId: 'ex-hip-mobility',
          name: 'Мобільність кульшових суглобів',
          muscleGroup: 'Мобільність',
          trackingType: 'duration',
          sets: [{ id: 's19', weightKg: 0, reps: 1, durationSec: 720, completed: true }],
        },
        {
          id: 'we-8',
          exerciseId: 'ex-thoracic-stretch',
          name: 'Розкриття грудного відділу',
          muscleGroup: 'Мобільність',
          trackingType: 'duration',
          sets: [{ id: 's20', weightKg: 0, reps: 1, durationSec: 600, completed: true }],
        },
      ],
    },
    {
      id: 'w-prev-4',
      title: 'Спина та біцепс',
      date: addDays(today, -4),
      startTime: '08:00',
      category: 'strength',
      durationMinutes: 58,
      rpe: 8,
      completed: true,
      exercises: [
        {
          id: 'we-9',
          exerciseId: 'ex-deadlift',
          name: 'Станова тяга',
          muscleGroup: 'Спина',
          trackingType: 'strength',
          sets: [
            { id: 's21', weightKg: 110, reps: 5, completed: true },
            { id: 's22', weightKg: 125, reps: 5, completed: true },
            { id: 's23', weightKg: 130, reps: 3, completed: true },
          ],
        },
        {
          id: 'we-10',
          exerciseId: 'ex-pullups',
          name: 'Підтягування широким хватом',
          muscleGroup: 'Спина',
          trackingType: 'strength',
          sets: [
            { id: 's24', weightKg: 10, reps: 8, completed: true },
            { id: 's25', weightKg: 10, reps: 8, completed: true },
            { id: 's26', weightKg: 10, reps: 7, completed: true },
          ],
        },
        {
          id: 'we-10b',
          exerciseId: 'ex-bicep-curl',
          name: 'Підйом штанги на біцепс',
          muscleGroup: 'Руки',
          trackingType: 'strength',
          sets: [
            { id: 's26a', weightKg: 30, reps: 10, completed: true },
            { id: 's26b', weightKg: 32.5, reps: 8, completed: true },
            { id: 's26c', weightKg: 32.5, reps: 8, completed: true },
          ],
        },
      ],
    },
    {
      id: 'w-prev-6',
      title: 'Інтервальний HIIT комплекс',
      date: addDays(today, -6),
      startTime: '17:30',
      category: 'hiit',
      durationMinutes: 28,
      rpe: 9,
      completed: true,
      exercises: [
        {
          id: 'we-11',
          exerciseId: 'ex-burpees',
          name: 'Берпі інтервали',
          muscleGroup: 'Кардіо',
          trackingType: 'duration',
          sets: [{ id: 's27', weightKg: 0, reps: 1, durationSec: 900, completed: true }],
        },
        {
          id: 'we-12',
          exerciseId: 'ex-plank',
          name: 'Планка на передпліччях',
          muscleGroup: 'Кор',
          trackingType: 'duration',
          sets: [{ id: 's28', weightKg: 0, reps: 1, durationSec: 120, completed: true }],
        },
      ],
    },
    {
      id: 'w-prev-8',
      title: 'Дистанційний велозаїзд',
      date: addDays(today, -8),
      startTime: '10:00',
      category: 'cardio',
      durationMinutes: 46,
      rpe: 7,
      completed: true,
      exercises: [
        {
          id: 'we-13',
          exerciseId: 'ex-cycling',
          name: 'Велотренажер / шосе',
          muscleGroup: 'Кардіо',
          trackingType: 'cardio',
          sets: [
            {
              id: 's29',
              weightKg: 0,
              reps: 1,
              distanceKm: 18.4,
              durationSec: 2760,
              completed: true,
            },
          ],
        },
      ],
    },
    {
      id: 'w-prev-10',
      title: 'Жимове тренування',
      date: addDays(today, -10),
      startTime: '08:20',
      category: 'strength',
      durationMinutes: 50,
      rpe: 8,
      completed: true,
      exercises: [
        {
          id: 'we-14',
          exerciseId: 'ex-bench',
          name: 'Жим штанги лежачи',
          muscleGroup: 'Груди',
          trackingType: 'strength',
          sets: [
            { id: 's30', weightKg: 75, reps: 8, completed: true },
            { id: 's31', weightKg: 77.5, reps: 6, completed: true },
            { id: 's32', weightKg: 77.5, reps: 6, completed: true },
          ],
        },
      ],
    },
    {
      id: 'w-prev-16',
      title: 'Силовий день: груди та трицепс',
      date: addDays(today, -16),
      startTime: '08:10',
      category: 'strength',
      durationMinutes: 54,
      rpe: 8,
      completed: true,
      exercises: [
        {
          id: 'we-15',
          exerciseId: 'ex-bench',
          name: 'Жим штанги лежачи',
          muscleGroup: 'Груди',
          trackingType: 'strength',
          sets: [
            { id: 's33', weightKg: 72.5, reps: 8, completed: true },
            { id: 's34', weightKg: 75, reps: 6, completed: true },
            { id: 's35', weightKg: 75, reps: 6, completed: true },
          ],
        },
        {
          id: 'we-16',
          exerciseId: 'ex-ohp',
          name: 'Армійський жим стоячи',
          muscleGroup: 'Плечі',
          trackingType: 'strength',
          sets: [
            { id: 's36', weightKg: 42.5, reps: 8, completed: true },
            { id: 's37', weightKg: 45, reps: 6, completed: true },
          ],
        },
      ],
    },
    {
      id: 'w-prev-21',
      title: 'Присідання та задня поверхня стегна',
      date: addDays(today, -21),
      startTime: '08:30',
      category: 'strength',
      durationMinutes: 60,
      rpe: 8,
      completed: true,
      exercises: [
        {
          id: 'we-17',
          exerciseId: 'ex-squat',
          name: 'Присідання зі штангою',
          muscleGroup: 'Ноги',
          trackingType: 'strength',
          sets: [
            { id: 's38', weightKg: 85, reps: 8, completed: true },
            { id: 's39', weightKg: 95, reps: 6, completed: true },
            { id: 's40', weightKg: 100, reps: 5, completed: true },
          ],
        },
      ],
    },
    {
      id: 'w-prev-26',
      title: 'Базовий жим та спина',
      date: addDays(today, -26),
      startTime: '08:05',
      category: 'strength',
      durationMinutes: 48,
      rpe: 7,
      completed: true,
      exercises: [
        {
          id: 'we-18',
          exerciseId: 'ex-bench',
          name: 'Жим штанги лежачи',
          muscleGroup: 'Груди',
          trackingType: 'strength',
          sets: [
            { id: 's41', weightKg: 67.5, reps: 8, completed: true },
            { id: 's42', weightKg: 72.5, reps: 6, completed: true },
            { id: 's43', weightKg: 72.5, reps: 6, completed: true },
          ],
        },
        {
          id: 'we-19',
          exerciseId: 'ex-squat',
          name: 'Присідання зі штангою',
          muscleGroup: 'Ноги',
          trackingType: 'strength',
          sets: [
            { id: 's44', weightKg: 85, reps: 6, completed: true },
            { id: 's45', weightKg: 92.5, reps: 5, completed: true },
          ],
        },
      ],
    },
    ...buildHistoricalSeedSessions(today),
  ];
}

function buildHistoricalSeedSessions(today: string): WorkoutSession[] {
  const templates: {
    title: string;
    category: WorkoutSession['category'];
    min: number;
    rpe: number;
  }[] = [
    { title: 'Силове: верх тіла', category: 'strength', min: 52, rpe: 8 },
    { title: 'Силове: ноги та кор', category: 'strength', min: 58, rpe: 8 },
    { title: 'Ранковий темповий біг', category: 'cardio', min: 35, rpe: 7 },
    { title: 'Інтервальний HIIT', category: 'hiit', min: 26, rpe: 9 },
    { title: 'Мобільність та відновлення', category: 'mobility', min: 22, rpe: 4 },
    { title: 'Велотренування середньої інтенсивності', category: 'cardio', min: 48, rpe: 7 },
    { title: 'Фулбаді силова сесія', category: 'strength', min: 64, rpe: 8 },
  ];

  const items: WorkoutSession[] = [];
  // Deterministic cadence from -35 to -355 days (keeps last 30 days untouched)
  for (let offset = 35; offset <= 355; offset += 1) {
    const hash = (offset * 37 + 13) % 19;
    // Roughly ~3-4 workouts per week with occasional double-session days and rest weeks
    const weekBucket = Math.floor(offset / 7);
    if (weekBucket % 11 === 5 && hash > 3) continue; // occasional lighter recovery week
    if (hash > 9) continue;

    const tpl = templates[(offset + hash) % templates.length];
    const duration = Math.max(18, tpl.min + ((hash % 5) - 2) * 5);
    const rpe = Math.min(10, Math.max(4, tpl.rpe + ((offset % 3) - 1)));
    const date = addDays(today, -offset);

    items.push({
      id: `w-hist-${offset}`,
      title: tpl.title,
      date,
      startTime: hash % 2 === 0 ? '08:15' : '18:30',
      category: tpl.category,
      durationMinutes: duration,
      rpe,
      completed: true,
      exercises: [],
    });

    // Occasional second light mobility/cardio session on high-volume days
    if (hash === 0 || hash === 4) {
      items.push({
        id: `w-hist-${offset}-b`,
        title: 'Вечірня розтяжка та дихання',
        date,
        startTime: '20:30',
        category: 'mobility',
        durationMinutes: 20,
        rpe: 4,
        completed: true,
        exercises: [],
      });
    }
  }

  return items;
}

