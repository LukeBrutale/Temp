import type { WorkoutTemplate } from '../types/workout.ts';

export const WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  {
    id: 'tpl-push',
    title: 'Верх тіла: жим та плечі',
    category: 'strength',
    estimatedMinutes: 55,
    description: 'Базові жимові рухи на груди, дельти та трицепс з прогресією ваги.',
    exercises: [
      {
        exerciseId: 'ex-bench',
        name: 'Жим штанги лежачи',
        muscleGroup: 'Груди',
        trackingType: 'strength',
        sets: [
          { id: 't1', weightKg: 75, reps: 8, completed: false },
          { id: 't2', weightKg: 80, reps: 6, completed: false },
          { id: 't3', weightKg: 80, reps: 6, completed: false },
        ],
      },
      {
        exerciseId: 'ex-ohp',
        name: 'Армійський жим стоячи',
        muscleGroup: 'Плечі',
        trackingType: 'strength',
        sets: [
          { id: 't4', weightKg: 45, reps: 8, completed: false },
          { id: 't5', weightKg: 45, reps: 8, completed: false },
          { id: 't6', weightKg: 45, reps: 8, completed: false },
        ],
      },
      {
        exerciseId: 'ex-lateral-raise',
        name: 'Махи гантелями в сторони',
        muscleGroup: 'Плечі',
        trackingType: 'strength',
        sets: [
          { id: 't7', weightKg: 10, reps: 15, completed: false },
          { id: 't8', weightKg: 10, reps: 15, completed: false },
        ],
      },
    ],
  },
  {
    id: 'tpl-legs',
    title: 'Сила ніг та сідниць',
    category: 'strength',
    estimatedMinutes: 60,
    description: 'Присідання, румунська тяга та одностороння робота на стабілізацію.',
    exercises: [
      {
        exerciseId: 'ex-squat',
        name: 'Присідання зі штангою',
        muscleGroup: 'Ноги',
        trackingType: 'strength',
        sets: [
          { id: 'l1', weightKg: 90, reps: 8, completed: false },
          { id: 'l2', weightKg: 100, reps: 6, completed: false },
          { id: 'l3', weightKg: 100, reps: 6, completed: false },
        ],
      },
      {
        exerciseId: 'ex-rdl',
        name: 'Румунська тяга з гантелями',
        muscleGroup: 'Ноги',
        trackingType: 'strength',
        sets: [
          { id: 'l4', weightKg: 48, reps: 10, completed: false },
          { id: 'l5', weightKg: 48, reps: 10, completed: false },
        ],
      },
      {
        exerciseId: 'ex-lunges',
        name: 'Випади з гантелями',
        muscleGroup: 'Ноги',
        trackingType: 'strength',
        sets: [
          { id: 'l6', weightKg: 24, reps: 12, completed: false },
          { id: 'l7', weightKg: 24, reps: 12, completed: false },
        ],
      },
    ],
  },
  {
    id: 'tpl-run5k',
    title: 'Темповий біг 5 км',
    category: 'cardio',
    estimatedMinutes: 30,
    description: 'Рівномірний аеробний біг із контролем пульсу та каденсу.',
    exercises: [
      {
        exerciseId: 'ex-run',
        name: 'Біг на вулиці / доріжці',
        muscleGroup: 'Кардіо',
        trackingType: 'cardio',
        sets: [
          { id: 'c1', weightKg: 0, reps: 1, distanceKm: 5.0, durationSec: 1620, completed: false },
        ],
      },
    ],
  },
  {
    id: 'tpl-hiit',
    title: 'Функціональний HIIT 25 хв',
    category: 'hiit',
    estimatedMinutes: 25,
    description: 'Високоінтенсивні інтервали 40с робота / 20с відпочинок для витривалості.',
    exercises: [
      {
        exerciseId: 'ex-burpees',
        name: 'Берпі інтервали',
        muscleGroup: 'Кардіо',
        trackingType: 'duration',
        sets: [
          { id: 'h1', weightKg: 0, reps: 1, durationSec: 240, completed: false },
        ],
      },
      {
        exerciseId: 'ex-plank',
        name: 'Планка на передпліччях',
        muscleGroup: 'Кор',
        trackingType: 'duration',
        sets: [
          { id: 'h2', weightKg: 0, reps: 1, durationSec: 90, completed: false },
          { id: 'h3', weightKg: 0, reps: 1, durationSec: 90, completed: false },
        ],
      },
    ],
  },
  {
    id: 'tpl-mobility',
    title: 'Вечірня мобільність та відновлення',
    category: 'mobility',
    estimatedMinutes: 20,
    description: 'Зняття напруги після робочого дня, тазостегнові суглоби та грудний відділ.',
    exercises: [
      {
        exerciseId: 'ex-hip-mobility',
        name: 'Мобільність кульшових суглобів',
        muscleGroup: 'Мобільність',
        trackingType: 'duration',
        sets: [
          { id: 'm1', weightKg: 0, reps: 1, durationSec: 600, completed: false },
        ],
      },
      {
        exerciseId: 'ex-thoracic-stretch',
        name: 'Розкриття грудного відділу',
        muscleGroup: 'Мобільність',
        trackingType: 'duration',
        sets: [
          { id: 'm2', weightKg: 0, reps: 1, durationSec: 480, completed: false },
        ],
      },
    ],
  },
];
