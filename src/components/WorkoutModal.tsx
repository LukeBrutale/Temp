import React, { useMemo, useState } from 'react';
import { Calculator, Gauge, History, Plus, Timer, Trash2, X } from 'lucide-react';
import {
  ExerciseDefinition,
  MuscleGroup,
  WorkoutCategory,
  WorkoutExercise,
  WorkoutSession,
} from '../types/workout';
import {
  CATEGORY_LABELS,
  estimateSessionRpe,
  formatUkDateShort,
  getExerciseHistoryPrediction,
} from '../utils/workoutStats';
import { OneRepMaxModal } from './OneRepMaxModal';
import { RpeCalculatorModal } from './RpeCalculatorModal';

interface WorkoutModalProps {
  initialSession?: WorkoutSession | null;
  defaultDate: string;
  exercisesCatalog: ExerciseDefinition[];
  historySessions?: WorkoutSession[];
  onSave: (session: WorkoutSession, mode: 'log' | 'start-live') => void;
  onClose: () => void;
}

const MUSCLE_GROUPS: MuscleGroup[] = [
  'Груди',
  'Спина',
  'Ноги',
  'Плечі',
  'Руки',
  'Кор',
  'Кардіо',
  'Мобільність',
];

export const WorkoutModal: React.FC<WorkoutModalProps> = ({
  initialSession,
  defaultDate,
  exercisesCatalog,
  historySessions = [],
  onSave,
  onClose,
}) => {
  const isEditing = Boolean(initialSession);

  const [title, setTitle] = useState(initialSession?.title ?? '');
  const [date, setDate] = useState(initialSession?.date ?? defaultDate);
  const [startTime, setStartTime] = useState(initialSession?.startTime ?? '08:30');
  const [category, setCategory] = useState<WorkoutCategory>(
    initialSession?.category ?? 'strength'
  );
  const [durationMinutes, setDurationMinutes] = useState<number>(
    initialSession?.durationMinutes ?? 45
  );
  const [rpe, setRpe] = useState<number>(initialSession?.rpe ?? 7);
  const [notes, setNotes] = useState(initialSession?.notes ?? '');
  const [exercises, setExercises] = useState<WorkoutExercise[]>(
    initialSession?.exercises ?? []
  );

  // Quick exercise adder state
  const [selectedCatalogId, setSelectedCatalogId] = useState(
    exercisesCatalog[0]?.id ?? ''
  );
  const [customExName, setCustomExName] = useState('');
  const [customMuscle, setCustomMuscle] = useState<MuscleGroup>('Груди');
  const [customTracking, setCustomTracking] = useState<
    'strength' | 'cardio' | 'duration'
  >('strength');
  const [showCustomEx, setShowCustomEx] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [oneRmTarget, setOneRmTarget] = useState<{
    exId?: string;
    exerciseName?: string;
    weightKg: number;
    reps: number;
  } | null>(null);
  const [rpeTarget, setRpeTarget] = useState<{
    exId?: string;
    exerciseName?: string;
    weightKg: number;
    reps: number;
  } | null>(null);
  const [rpeAutoHint, setRpeAutoHint] = useState<string | null>(null);

  const strengthExerciseNames = useMemo(() => {
    const names = new Set<string>();
    for (const ex of exercises) {
      if (ex.trackingType === 'strength') names.add(ex.name);
    }
    for (const ex of exercisesCatalog) {
      if (ex.trackingType === 'strength') names.add(ex.name);
    }
    return Array.from(names);
  }, [exercises, exercisesCatalog]);

  const addExerciseFromCatalog = () => {
    const def = exercisesCatalog.find((e) => e.id === selectedCatalogId);
    if (!def) return;
    const historyPred = getExerciseHistoryPrediction(
      historySessions,
      def.name,
      initialSession?.id
    );
    const defaultSets = historyPred
      ? historyPred.expectedSets
      : [
          def.trackingType === 'strength'
            ? { id: `s-${Date.now()}`, weightKg: 40, reps: 10, completed: true }
            : def.trackingType === 'cardio'
              ? {
                  id: `s-${Date.now()}`,
                  weightKg: 0,
                  reps: 1,
                  distanceKm: 5,
                  durationSec: 1800,
                  completed: true,
                }
              : {
                  id: `s-${Date.now()}`,
                  weightKg: 0,
                  reps: 1,
                  durationSec: 120,
                  completed: true,
                },
        ];

    const newEx: WorkoutExercise = {
      id: `we-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      exerciseId: def.id,
      name: def.name,
      muscleGroup: def.muscleGroup,
      trackingType: def.trackingType,
      restSeconds: def.trackingType === 'strength' ? 90 : 60,
      sets: defaultSets,
    };
    setExercises((prev) => [...prev, newEx]);
  };

  const addCustomExercise = () => {
    const trimmed = customExName.trim();
    if (!trimmed) return;
    const newEx: WorkoutExercise = {
      id: `we-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: trimmed,
      muscleGroup: customMuscle,
      trackingType: customTracking,
      restSeconds: customTracking === 'strength' ? 90 : 60,
      sets: [
        customTracking === 'strength'
          ? { id: `s-${Date.now()}`, weightKg: 30, reps: 10, completed: true }
          : customTracking === 'cardio'
            ? {
                id: `s-${Date.now()}`,
                weightKg: 0,
                reps: 1,
                distanceKm: 3,
                durationSec: 1200,
                completed: true,
              }
            : {
                id: `s-${Date.now()}`,
                weightKg: 0,
                reps: 1,
                durationSec: 90,
                completed: true,
              },
      ],
    };
    setExercises((prev) => [...prev, newEx]);
    setCustomExName('');
    setShowCustomEx(false);
  };

  const removeExercise = (exId: string) => {
    setExercises((prev) => prev.filter((ex) => ex.id !== exId));
  };

  const updateExerciseRestSeconds = (exId: string, restSeconds: number) => {
    const clamped = Math.min(600, Math.max(0, Math.round(restSeconds)));
    setExercises((prev) =>
      prev.map((ex) => (ex.id === exId ? { ...ex, restSeconds: clamped } : ex))
    );
  };

  const addSet = (exId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exId) return ex;
        const last = ex.sets[ex.sets.length - 1];
        return {
          ...ex,
          sets: [
            ...ex.sets,
            {
              id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              weightKg: last?.weightKg ?? 40,
              reps: last?.reps ?? 10,
              distanceKm: last?.distanceKm,
              durationSec: last?.durationSec,
              completed: true,
            },
          ],
        };
      })
    );
  };

  const removeSet = (exId: string, setId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exId) return ex;
        return { ...ex, sets: ex.sets.filter((s) => s.id !== setId) };
      })
    );
  };

  const updateSet = (
    exId: string,
    setId: string,
    patch: Partial<{
      weightKg: number;
      reps: number;
      distanceKm: number;
      durationSec: number;
      note: string;
    }>
  ) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exId) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
        };
      })
    );
  };

  const handleSubmit = (mode: 'log' | 'start-live') => {
    const finalTitle = title.trim() || `${CATEGORY_LABELS[category]} тренування`;
    if (durationMinutes <= 0 && mode === 'log') {
      setErrorMsg('Вкажіть тривалість тренування більше 0 хвилин.');
      return;
    }

    const preparedExercises = exercises.map((ex) => ({
      ...ex,
      sets: ex.sets.map((s) => ({
        ...s,
        note: s.note?.trim() ? s.note.trim() : undefined,
        completed: mode === 'start-live' ? false : s.completed,
      })),
    }));

    const session: WorkoutSession = {
      id: initialSession?.id ?? `w-${Date.now()}`,
      title: finalTitle,
      date,
      startTime,
      category,
      durationMinutes: Math.max(1, Math.round(durationMinutes)),
      rpe,
      notes: notes.trim() || undefined,
      exercises: preparedExercises,
      completed: mode === 'log',
    };

    onSave(session, mode);
  };

  const openGeneralOneRm = () => {
    const firstStrengthEx = exercises.find((ex) => ex.trackingType === 'strength');
    const bestSet = firstStrengthEx?.sets.reduce(
      (best, s) => (s.weightKg > best.weightKg ? s : best),
      firstStrengthEx.sets[0] ?? { weightKg: 80, reps: 5 }
    );
    setOneRmTarget({
      exId: firstStrengthEx?.id,
      exerciseName: firstStrengthEx?.name,
      weightKg: bestSet?.weightKg || 80,
      reps: bestSet?.reps || 5,
    });
  };

  const openExerciseOneRm = (ex: WorkoutExercise) => {
    const bestSet = ex.sets.reduce(
      (best, s) => (s.weightKg > best.weightKg ? s : best),
      ex.sets[0] ?? { weightKg: 60, reps: 8 }
    );
    setOneRmTarget({
      exId: ex.id,
      exerciseName: ex.name,
      weightKg: bestSet?.weightKg || 60,
      reps: bestSet?.reps || 8,
    });
  };

  const handleApplyWorkingSetFromOneRm = (weightKg: number, reps: number) => {
    if (!oneRmTarget?.exId) return;
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== oneRmTarget.exId) return ex;
        return {
          ...ex,
          sets: [
            ...ex.sets,
            {
              id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              weightKg,
              reps,
              completed: true,
            },
          ],
        };
      })
    );
  };

  const openGeneralRpeTool = () => {
    const firstStrengthEx = exercises.find((ex) => ex.trackingType === 'strength');
    const bestSet = firstStrengthEx?.sets.reduce(
      (best, s) => (s.weightKg > best.weightKg ? s : best),
      firstStrengthEx.sets[0] ?? { weightKg: 80, reps: 6 }
    );
    setRpeTarget({
      exId: firstStrengthEx?.id,
      exerciseName: firstStrengthEx?.name ?? strengthExerciseNames[0],
      weightKg: bestSet?.weightKg || 80,
      reps: bestSet?.reps || 6,
    });
  };

  const openExerciseRpeTool = (ex: WorkoutExercise) => {
    const bestSet = ex.sets.reduce(
      (best, s) => (s.weightKg > best.weightKg ? s : best),
      ex.sets[0] ?? { weightKg: 60, reps: 8 }
    );
    setRpeTarget({
      exId: ex.id,
      exerciseName: ex.name,
      weightKg: bestSet?.weightKg || 60,
      reps: bestSet?.reps || 8,
    });
  };

  const handleAutoCalculateSessionRpe = () => {
    const est = estimateSessionRpe(exercises, historySessions, initialSession?.id);
    if (!est) {
      openGeneralRpeTool();
      return;
    }
    setRpe(est.rpe);
    setRpeAutoHint(`Розраховано RPE ${est.rpe}/10 за ${est.matchedCount} підх.`);
    window.setTimeout(() => setRpeAutoHint(null), 3500);
  };

  const handleFillExpectedSetsFromHistory = (exId: string, exName: string) => {
    const pred = getExerciseHistoryPrediction(
      historySessions,
      exName,
      initialSession?.id
    );
    if (!pred) return;
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exId
          ? {
              ...ex,
              sets: pred.expectedSets.map((s, i) => ({
                ...s,
                note: ex.sets[i]?.note,
              })),
            }
          : ex
      )
    );
  };

  const handleApplyExpectedWeightFromRpeModal = (
    exerciseName: string,
    weightKg: number,
    reps: number
  ) => {
    if (!rpeTarget?.exId) return;
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== rpeTarget.exId) return ex;
        return {
          ...ex,
          name: exerciseName || ex.name,
          sets: [
            ...ex.sets,
            {
              id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              weightKg,
              reps,
              completed: true,
            },
          ],
        };
      })
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/55 dark:bg-slate-950/75 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workout-modal-title"
    >
      <div className="w-full sm:max-w-2xl max-h-[92vh] bg-[var(--bg-surface)] rounded-t-3xl sm:rounded-2xl border border-[var(--border-subtle)] shadow-2xl flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between gap-4 shrink-0">
          <h2
            id="workout-modal-title"
            className="text-xl font-semibold tracking-tight text-[var(--text-primary)]"
          >
            {isEditing ? 'Редагувати тренування' : 'Нове тренування'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрити вікно"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 text-sm text-rose-700 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label
                htmlFor="workout-title"
                className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
              >
                Назва тренування
              </label>
              <input
                id="workout-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Наприклад: Жим та плечі, Вечірній біг"
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-orange-600"
              />
            </div>

            <div>
              <span className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                Тип навантаження
              </span>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-[var(--bg-surface-muted)] rounded-xl">
                {(Object.keys(CATEGORY_LABELS) as WorkoutCategory[]).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`min-h-[40px] px-3 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                      category === cat
                        ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="workout-date"
                  className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
                >
                  Дата
                </label>
                <input
                  id="workout-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:border-orange-600"
                />
              </div>
              <div>
                <label
                  htmlFor="workout-time"
                  className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
                >
                  Початок
                </label>
                <input
                  id="workout-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:border-orange-600"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="workout-duration"
                className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
              >
                Тривалість (хв)
              </label>
              <input
                id="workout-duration"
                type="number"
                min={1}
                max={360}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-sm font-mono tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-orange-600"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                <label htmlFor="workout-rpe">Інтенсивність (RPE)</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAutoCalculateSessionRpe}
                    title="Автоматично розрахувати RPE за підходами"
                    className="text-xs font-semibold text-orange-700 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 underline underline-offset-4 whitespace-nowrap"
                  >
                    Авто-RPE
                  </button>
                  <span className="font-mono tabular-nums text-[var(--text-primary)]">{rpe}/10</span>
                </div>
              </div>
              <input
                id="workout-rpe"
                type="range"
                min={1}
                max={10}
                value={rpe}
                onChange={(e) => setRpe(Number(e.target.value))}
                className="w-full h-11 accent-orange-600 cursor-pointer"
              />
              {rpeAutoHint && (
                <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 mt-0.5">
                  {rpeAutoHint}
                </p>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--border-subtle)]">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Вправи та підходи ({exercises.length})
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={openGeneralRpeTool}
                  className="min-h-[38px] px-3 text-xs font-semibold rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-primary)] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Gauge className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                  Розрахунок RPE
                </button>
                <button
                  type="button"
                  onClick={openGeneralOneRm}
                  className="min-h-[38px] px-3 text-xs font-semibold rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-primary)] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Calculator className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                  Калькулятор 1ПМ
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustomEx((v) => !v)}
                  className="text-xs font-semibold text-orange-700 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 underline underline-offset-4 whitespace-nowrap ml-1"
                >
                  {showCustomEx ? 'Вибрати зі списку' : '+ Своя вправа'}
                </button>
              </div>
            </div>

            {!showCustomEx ? (
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <select
                  value={selectedCatalogId}
                  onChange={(e) => setSelectedCatalogId(e.target.value)}
                  aria-label="Обрати вправу зі списку"
                  className="flex-1 min-h-[44px] px-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-orange-600"
                >
                  {exercisesCatalog.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name} ({ex.muscleGroup})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addExerciseFromCatalog}
                  className="min-h-[44px] px-4 py-2 text-sm font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  Додати вправу
                </button>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-3 mb-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <input
                    type="text"
                    value={customExName}
                    onChange={(e) => setCustomExName(e.target.value)}
                    placeholder="Назва вправи"
                    className="sm:col-span-3 min-h-[42px] px-3 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-orange-600"
                  />
                  <select
                    value={customMuscle}
                    onChange={(e) => setCustomMuscle(e.target.value as MuscleGroup)}
                    className="min-h-[42px] px-3 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)]"
                  >
                    {MUSCLE_GROUPS.map((mg) => (
                      <option key={mg} value={mg}>
                        {mg}
                      </option>
                    ))}
                  </select>
                  <select
                    value={customTracking}
                    onChange={(e) =>
                      setCustomTracking(
                        e.target.value as 'strength' | 'cardio' | 'duration'
                      )
                    }
                    className="min-h-[42px] px-3 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)]"
                  >
                    <option value="strength">Силова (вага × повт.)</option>
                    <option value="cardio">Кардіо (км × хв)</option>
                    <option value="duration">Час (секунди)</option>
                  </select>
                  <button
                    type="button"
                    onClick={addCustomExercise}
                    className="min-h-[42px] px-4 text-sm font-semibold rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white transition-colors whitespace-nowrap"
                  >
                    Додати
                  </button>
                </div>
              </div>
            )}

            {exercises.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] py-3">
                Додайте вправи зі списку або збережіть тренування лише за тривалістю.
              </p>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)] border-t border-b border-[var(--border-subtle)]">
                {exercises.map((ex) => {
                  const historyPred = getExerciseHistoryPrediction(
                    historySessions,
                    ex.name,
                    initialSession?.id
                  );

                  return (
                  <div key={ex.id} className="py-4 space-y-2.5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[var(--text-primary)]">{ex.name}</div>
                        <div className="text-xs text-[var(--text-muted)]">
                          {ex.muscleGroup}
                          {historyPred && (
                            <>
                              <span aria-hidden="true"> · </span>
                              <span className="text-[var(--text-secondary)]">
                                Минулого разу ({formatUkDateShort(historyPred.lastDate)}):{' '}
                                <span className="font-mono font-medium">
                                  {ex.trackingType === 'strength'
                                    ? `${historyPred.lastBestWeightKg} кг × ${historyPred.lastBestReps}`
                                    : `${historyPred.expectedSets.length} підх.`}
                                </span>
                              </span>
                            </>
                          )}
                        </div>
                        {historyPred && ex.trackingType === 'strength' && (
                          <div className="text-[11px] text-orange-700 dark:text-orange-400 mt-0.5">
                            {historyPred.progressionNote}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        {historyPred && (
                          <button
                            type="button"
                            onClick={() => handleFillExpectedSetsFromHistory(ex.id, ex.name)}
                            title="Заповнити очікувану вагу на основі попередніх тренувань"
                            className="min-h-[38px] px-2.5 text-xs font-semibold rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] transition-colors inline-flex items-center gap-1 whitespace-nowrap"
                          >
                            <History className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                            Автовага
                          </button>
                        )}
                        {ex.trackingType === 'strength' && (
                          <>
                            <button
                              type="button"
                              onClick={() => openExerciseRpeTool(ex)}
                              title="Розрахувати RPE або цільову вагу"
                              className="min-h-[38px] px-2.5 text-xs font-semibold rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] transition-colors inline-flex items-center gap-1 whitespace-nowrap"
                            >
                              <Gauge className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                              RPE
                            </button>
                            <button
                              type="button"
                              onClick={() => openExerciseOneRm(ex)}
                              title="Розрахувати 1ПМ для цієї вправи"
                              className="min-h-[38px] px-2.5 text-xs font-semibold rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] transition-colors inline-flex items-center gap-1 whitespace-nowrap"
                            >
                              <Calculator className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                              1ПМ
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => addSet(ex.id)}
                          className="min-h-[38px] px-3 text-xs font-semibold rounded-lg bg-[var(--bg-surface-muted)] hover:bg-slate-200 dark:hover:bg-slate-700 text-[var(--text-primary)] transition-colors whitespace-nowrap"
                        >
                          + Підхід
                        </button>
                        <button
                          type="button"
                          onClick={() => removeExercise(ex.id)}
                          aria-label={`Видалити вправу ${ex.name}`}
                          className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Individual Rest Timer Configuration */}
                    <div className="flex flex-wrap items-center gap-2 py-1 text-xs text-[var(--text-secondary)]">
                      <span className="inline-flex items-center gap-1.5 font-medium text-[var(--text-secondary)]">
                        <Timer className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400 shrink-0" />
                        <span>Відпочинок:</span>
                      </span>
                      <div className="flex items-center gap-1">
                        {[60, 90, 120, 180].map((sec) => {
                          const currentRest = ex.restSeconds ?? (ex.trackingType === 'strength' ? 90 : 60);
                          const isSelected = currentRest === sec;
                          return (
                            <button
                              key={sec}
                              type="button"
                              onClick={() => updateExerciseRestSeconds(ex.id, sec)}
                              className={`min-h-[34px] px-2.5 text-xs font-mono font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                                isSelected
                                  ? 'bg-slate-900 dark:bg-orange-600 text-white border-slate-900 dark:border-orange-500'
                                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:bg-[var(--bg-surface-muted)]'
                              }`}
                            >
                              {sec}с
                            </button>
                          );
                        })}
                      </div>
                      <label className="inline-flex items-center gap-1 ml-1">
                        <input
                          type="number"
                          min={0}
                          max={600}
                          step={15}
                          aria-label={`Час відпочинку для ${ex.name} у секундах`}
                          value={ex.restSeconds ?? (ex.trackingType === 'strength' ? 90 : 60)}
                          onChange={(e) =>
                            updateExerciseRestSeconds(ex.id, Number(e.target.value))
                          }
                          className="w-16 min-h-[34px] px-2 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] font-mono text-xs tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-orange-600"
                        />
                        <span className="text-[var(--text-muted)]">сек</span>
                      </label>
                    </div>

                    <div className="space-y-2.5">
                      {ex.sets.map((set, idx) => (
                        <div key={set.id} className="flex flex-wrap items-center gap-2">
                          <span className="w-6 text-xs font-mono tabular-nums text-[var(--text-muted)] shrink-0">
                            #{idx + 1}
                          </span>

                          {ex.trackingType === 'strength' && (
                            <>
                              <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                                <span>Вага</span>
                                <input
                                  type="number"
                                  min={0}
                                  step={2.5}
                                  value={set.weightKg}
                                  onChange={(e) =>
                                    updateSet(ex.id, set.id, {
                                      weightKg: Math.max(0, Number(e.target.value)),
                                    })
                                  }
                                  className="w-20 min-h-[38px] px-2.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] font-mono text-sm tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-orange-600"
                                />
                                <span>кг</span>
                              </label>
                              <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                                <span>Повт.</span>
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={set.reps}
                                  onChange={(e) =>
                                    updateSet(ex.id, set.id, {
                                      reps: Math.max(0, Number(e.target.value)),
                                    })
                                  }
                                  className="w-16 min-h-[38px] px-2.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] font-mono text-sm tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-orange-600"
                                />
                              </label>
                            </>
                          )}

                          {ex.trackingType === 'cardio' && (
                            <>
                              <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                                <span>Км</span>
                                <input
                                  type="number"
                                  min={0}
                                  step={0.1}
                                  value={set.distanceKm ?? 0}
                                  onChange={(e) =>
                                    updateSet(ex.id, set.id, {
                                      distanceKm: Math.max(0, Number(e.target.value)),
                                    })
                                  }
                                  className="w-20 min-h-[38px] px-2.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] font-mono text-sm tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-orange-600"
                                />
                              </label>
                              <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                                <span>Хв</span>
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={Math.round((set.durationSec ?? 0) / 60)}
                                  onChange={(e) =>
                                    updateSet(ex.id, set.id, {
                                      durationSec: Math.max(0, Number(e.target.value)) * 60,
                                    })
                                  }
                                  className="w-16 min-h-[38px] px-2.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] font-mono text-sm tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-orange-600"
                                />
                              </label>
                            </>
                          )}

                          {ex.trackingType === 'duration' && (
                            <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                              <span>Сек</span>
                              <input
                                type="number"
                                min={0}
                                step={15}
                                value={set.durationSec ?? 60}
                                onChange={(e) =>
                                  updateSet(ex.id, set.id, {
                                    durationSec: Math.max(0, Number(e.target.value)),
                                  })
                                }
                                className="w-20 min-h-[38px] px-2.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] font-mono text-sm tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-orange-600"
                              />
                            </label>
                          )}

                          <input
                            type="text"
                            value={set.note ?? ''}
                            onChange={(e) =>
                              updateSet(ex.id, set.id, { note: e.target.value })
                            }
                            placeholder="Техніка або відчуття..."
                            aria-label={`Нотатка до підходу #${idx + 1} для ${ex.name}`}
                            className="order-last sm:order-none w-full sm:w-auto sm:flex-1 min-w-[160px] min-h-[38px] px-2.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-orange-600"
                          />

                          {ex.sets.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeSet(ex.id, set.id)}
                              aria-label="Видалити підхід"
                              className="ml-auto sm:ml-0 min-h-[36px] min-w-[36px] flex items-center justify-center text-[var(--text-muted)] hover:text-rose-600 dark:hover:text-rose-400 shrink-0"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="workout-notes"
              className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
            >
              Нотатки (самопочуття, прогресія)
            </label>
            <textarea
              id="workout-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Наприклад: легко зайшло на останньому підході..."
              className="w-full p-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-orange-600"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] flex flex-wrap items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 text-sm font-medium rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-surface-muted)] transition-colors whitespace-nowrap"
          >
            Скасувати
          </button>
          {!isEditing && (
            <button
              type="button"
              onClick={() => handleSubmit('start-live')}
              className="min-h-[44px] px-4 py-2 text-sm font-semibold rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-primary)] transition-colors whitespace-nowrap"
            >
              Почати таймер зараз
            </button>
          )}
          <button
            type="button"
            onClick={() => handleSubmit('log')}
            className="min-h-[44px] px-5 py-2 text-sm font-semibold rounded-xl bg-orange-600 hover:bg-orange-700 text-white transition-colors whitespace-nowrap"
          >
            {isEditing ? 'Зберегти зміни' : 'Зберегти тренування'}
          </button>
        </div>
      </div>

      {oneRmTarget && (
        <OneRepMaxModal
          initialWeightKg={oneRmTarget.weightKg}
          initialReps={oneRmTarget.reps}
          exerciseName={oneRmTarget.exerciseName}
          canApplyToExercise={Boolean(oneRmTarget.exId)}
          onApplyWorkingSet={handleApplyWorkingSetFromOneRm}
          onClose={() => setOneRmTarget(null)}
        />
      )}

      {rpeTarget && (
        <RpeCalculatorModal
          exercisesList={strengthExerciseNames}
          initialExerciseName={rpeTarget.exerciseName}
          initialWeightKg={rpeTarget.weightKg}
          initialReps={rpeTarget.reps}
          historySessions={historySessions}
          excludeSessionId={initialSession?.id}
          canApplyWorkingSet={Boolean(rpeTarget.exId)}
          onApplyRpeToSession={(nextRpe) => setRpe(nextRpe)}
          onApplyExpectedWeightToExercise={handleApplyExpectedWeightFromRpeModal}
          onClose={() => setRpeTarget(null)}
        />
      )}
    </div>
  );
};
