import React, { useEffect, useMemo, useState } from 'react';
import { Check, Gauge, History, Minus, Plus, X } from 'lucide-react';
import { WorkoutSession } from '../types/workout';
import {
  calculateEpley1RM,
  calculateExpectedWeightForRpe,
  estimateRpeFromSet,
  formatUkDateShort,
  getExerciseHistoryPrediction,
  getRpeDescription,
} from '../utils/workoutStats';

interface RpeCalculatorModalProps {
  exercisesList: string[];
  initialExerciseName?: string;
  initialWeightKg?: number;
  initialReps?: number;
  historySessions: WorkoutSession[];
  excludeSessionId?: string;
  canApplyWorkingSet?: boolean;
  onApplyRpeToSession: (rpe: number) => void;
  onApplyExpectedWeightToExercise?: (
    exerciseName: string,
    weightKg: number,
    reps: number
  ) => void;
  onClose: () => void;
}

export const RpeCalculatorModal: React.FC<RpeCalculatorModalProps> = ({
  exercisesList,
  initialExerciseName,
  initialWeightKg = 80,
  initialReps = 6,
  historySessions,
  excludeSessionId,
  canApplyWorkingSet = false,
  onApplyRpeToSession,
  onApplyExpectedWeightToExercise,
  onClose,
}) => {
  const [mode, setMode] = useState<'calc-rpe' | 'calc-weight'>('calc-rpe');
  const [selectedExercise, setSelectedExercise] = useState<string>(
    initialExerciseName || exercisesList[0] || ''
  );

  const historyPred = useMemo(
    () =>
      getExerciseHistoryPrediction(
        historySessions,
        selectedExercise,
        excludeSessionId
      ),
    [historySessions, selectedExercise, excludeSessionId]
  );

  const [weightKg, setWeightKg] = useState<number>(initialWeightKg || 80);
  const [reps, setReps] = useState<number>(initialReps || 6);
  const [reference1Rm, setReference1Rm] = useState<number>(
    () =>
      historyPred?.historicalBest1RmKg ||
      calculateEpley1RM(initialWeightKg || 80, initialReps || 6)
  );
  const [targetRpe, setTargetRpe] = useState<number>(8);
  const [targetReps, setTargetReps] = useState<number>(initialReps || 6);
  const [feedbackDone, setFeedbackDone] = useState<string | null>(null);

  useEffect(() => {
    if (historyPred && historyPred.historicalBest1RmKg > 0) {
      setReference1Rm(historyPred.historicalBest1RmKg);
      if (!initialExerciseName || selectedExercise !== initialExerciseName) {
        setWeightKg(historyPred.lastBestWeightKg || 60);
        setReps(historyPred.lastBestReps || 8);
      }
    }
  }, [historyPred, selectedExercise, initialExerciseName]);

  const rpeResult = useMemo(
    () => estimateRpeFromSet(weightKg, reps, reference1Rm),
    [weightKg, reps, reference1Rm]
  );

  const weightResult = useMemo(
    () => calculateExpectedWeightForRpe(reference1Rm, targetReps, targetRpe, 2.5),
    [reference1Rm, targetReps, targetRpe]
  );

  const handleApplyRpe = () => {
    onApplyRpeToSession(Math.min(10, Math.max(1, Math.round(rpeResult.rpe))));
    setFeedbackDone(`RPE ${Math.round(rpeResult.rpe)}/10 застосовано`);
    window.setTimeout(() => onClose(), 260);
  };

  const handleApplyWeight = () => {
    if (!onApplyExpectedWeightToExercise || weightResult.plateKg <= 0) return;
    onApplyExpectedWeightToExercise(
      selectedExercise,
      weightResult.plateKg,
      targetReps
    );
    setFeedbackDone(`${weightResult.plateKg} кг × ${targetReps} додано`);
    window.setTimeout(() => onClose(), 260);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-950/60 dark:bg-slate-950/75 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rpe-modal-title"
    >
      <div className="w-full sm:max-w-xl max-h-[90vh] bg-[var(--bg-surface)] rounded-t-3xl sm:rounded-2xl border border-[var(--border-subtle)] shadow-2xl flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-medium text-orange-700 dark:text-orange-400">
              <Gauge className="w-3.5 h-3.5 shrink-0" />
              <span>Розумний підбір навантаження</span>
            </div>
            <h2
              id="rpe-modal-title"
              className="mt-0.5 text-xl font-semibold tracking-tight text-[var(--text-primary)] truncate"
            >
              Розрахунок RPE та очікуваної ваги
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Закрити вікно RPE"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {/* Exercise Context & History Summary */}
          <div className="space-y-2">
            <label
              htmlFor="rpe-exercise-select"
              className="block text-xs font-semibold text-[var(--text-secondary)]"
            >
              Вправа (для підтягування історії тренувань)
            </label>
            <select
              id="rpe-exercise-select"
              value={selectedExercise}
              onChange={(e) => setSelectedExercise(e.target.value)}
              className="w-full min-h-[44px] px-3.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-sm font-medium text-[var(--text-primary)] focus:outline-none focus:border-orange-600"
            >
              {exercisesList.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>

            {historyPred ? (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-secondary)] pt-0.5">
                <History className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                <span>
                  Минулого разу ({formatUkDateShort(historyPred.lastDate)}):{' '}
                  <span className="font-mono font-semibold text-[var(--text-primary)]">
                    {historyPred.lastBestWeightKg} кг × {historyPred.lastBestReps}
                  </span>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Найкращий 1ПМ:{' '}
                  <span className="font-mono font-semibold text-orange-700 dark:text-orange-400">
                    {historyPred.historicalBest1RmKg} кг
                  </span>
                </span>
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">
                Попередніх силових записів для цієї вправи ще немає — вкажіть орієнтовний 1ПМ вручну.
              </p>
            )}
          </div>

          {/* Mode Tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-[var(--bg-surface-muted)] rounded-xl">
            <button
              type="button"
              onClick={() => setMode('calc-rpe')}
              className={`min-h-[40px] px-3 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                mode === 'calc-rpe'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Розрахувати RPE
            </button>
            <button
              type="button"
              onClick={() => setMode('calc-weight')}
              className={`min-h-[40px] px-3 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                mode === 'calc-weight'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Очікувана вага
            </button>
          </div>

          {/* Reference 1RM */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
              <label htmlFor="rpe-ref-1rm">Базовий максимум 1ПМ (кг)</label>
              {historyPred && historyPred.historicalBest1RmKg > 0 && (
                <button
                  type="button"
                  onClick={() => setReference1Rm(historyPred.historicalBest1RmKg)}
                  className="text-orange-700 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 underline underline-offset-4"
                >
                  Взяти з історії ({historyPred.historicalBest1RmKg} кг)
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setReference1Rm((v) => Math.max(5, Math.round((v - 2.5) * 10) / 10))}
                aria-label="Зменшити 1ПМ на 2.5 кг"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface-subtle)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] transition-colors"
              >
                <Minus className="w-4 h-4" />
              </button>
              <input
                id="rpe-ref-1rm"
                type="number"
                min={5}
                step={2.5}
                value={reference1Rm}
                onChange={(e) => setReference1Rm(Math.max(5, Number(e.target.value)))}
                className="w-full min-h-[44px] px-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-center font-mono text-base font-semibold tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-orange-600"
              />
              <button
                type="button"
                onClick={() => setReference1Rm((v) => Math.round((v + 2.5) * 10) / 10)}
                aria-label="Збільшити 1ПМ на 2.5 кг"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface-subtle)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {mode === 'calc-rpe' ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="rpe-input-weight"
                    className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
                  >
                    Виконана вага (кг)
                  </label>
                  <input
                    id="rpe-input-weight"
                    type="number"
                    min={0}
                    step={2.5}
                    value={weightKg}
                    onChange={(e) => setWeightKg(Math.max(0, Number(e.target.value)))}
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] font-mono text-base font-semibold tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-orange-600"
                  />
                </div>
                <div>
                  <label
                    htmlFor="rpe-input-reps"
                    className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
                  >
                    Кількість повторів
                  </label>
                  <input
                    id="rpe-input-reps"
                    type="number"
                    min={1}
                    max={30}
                    step={1}
                    value={reps}
                    onChange={(e) =>
                      setReps(Math.min(30, Math.max(1, Math.round(Number(e.target.value) || 1))))
                    }
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] font-mono text-base font-semibold tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-orange-600"
                  />
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900 dark:bg-slate-800/90 border border-slate-800 dark:border-slate-700 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-400">
                    Розрахунковий RPE підходу
                  </p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-4xl font-mono font-semibold tabular-nums">
                      {rpeResult.rpe}
                    </span>
                    <span className="text-base text-slate-400">/ 10</span>
                  </div>
                  <p className="mt-1 text-xs text-orange-300">{rpeResult.label}</p>
                </div>

                <div className="text-xs text-slate-300 space-y-1 font-mono tabular-nums sm:text-right">
                  <div>
                    <span className="text-slate-400 font-sans">Відсоток від 1ПМ: </span>
                    <span>{rpeResult.percent1Rm}%</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-sans">Запас (RIR): </span>
                    <span>~{rpeResult.rir} повт.</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="rpe-target-reps"
                    className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
                  >
                    Плановані повторення
                  </label>
                  <input
                    id="rpe-target-reps"
                    type="number"
                    min={1}
                    max={20}
                    step={1}
                    value={targetReps}
                    onChange={(e) =>
                      setTargetReps(
                        Math.min(20, Math.max(1, Math.round(Number(e.target.value) || 1)))
                      )
                    }
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] font-mono text-base font-semibold tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-orange-600"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                    <label htmlFor="rpe-target-slider">Цільовий RPE</label>
                    <span className="font-mono tabular-nums text-[var(--text-primary)]">
                      {targetRpe} / 10
                    </span>
                  </div>
                  <input
                    id="rpe-target-slider"
                    type="range"
                    min={6}
                    max={10}
                    step={0.5}
                    value={targetRpe}
                    onChange={(e) => setTargetRpe(Number(e.target.value))}
                    className="w-full h-11 accent-orange-600 cursor-pointer"
                  />
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900 dark:bg-slate-800/90 border border-slate-800 dark:border-slate-700 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-400">
                    Очікувана робоча вага
                  </p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-4xl font-mono font-semibold tabular-nums">
                      {weightResult.plateKg}
                    </span>
                    <span className="text-base text-slate-300">кг</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-300">
                    {getRpeDescription(targetRpe)}
                  </p>
                </div>

                <div className="text-xs text-slate-300 space-y-1 font-mono tabular-nums sm:text-right">
                  <div>
                    <span className="text-slate-400 font-sans">Точно: </span>
                    <span>{weightResult.exactKg} кг</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-sans">Інтенсивність: </span>
                    <span>{weightResult.percent1Rm}% 1ПМ</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {feedbackDone && (
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              <Check className="w-4 h-4" />
              <span>{feedbackDone}</span>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] flex flex-wrap items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 text-sm font-medium rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-surface-muted)] transition-colors whitespace-nowrap"
          >
            Закрити
          </button>

          {mode === 'calc-rpe' ? (
            <button
              type="button"
              onClick={handleApplyRpe}
              className="min-h-[44px] px-5 py-2 text-sm font-semibold rounded-xl bg-orange-600 hover:bg-orange-700 text-white transition-colors whitespace-nowrap"
            >
              Застосувати RPE {Math.round(rpeResult.rpe)}/10
            </button>
          ) : (
            canApplyWorkingSet &&
            onApplyExpectedWeightToExercise && (
              <button
                type="button"
                onClick={handleApplyWeight}
                className="min-h-[44px] px-5 py-2 text-sm font-semibold rounded-xl bg-orange-600 hover:bg-orange-700 text-white transition-colors whitespace-nowrap"
              >
                Додати підхід {weightResult.plateKg} кг × {targetReps}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
};
