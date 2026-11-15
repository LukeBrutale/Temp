import React, { useMemo, useState } from 'react';
import { Calculator, Check, Minus, Plus, X } from 'lucide-react';
import {
  OneRmFormula,
  calculateBrzycki1RM,
  calculateEpley1RM,
  calculateLombardi1RM,
  calculateOneRm,
  roundToPlateKg,
} from '../utils/workoutStats';

interface OneRepMaxModalProps {
  initialWeightKg?: number;
  initialReps?: number;
  exerciseName?: string;
  canApplyToExercise?: boolean;
  onApplyWorkingSet?: (weightKg: number, reps: number) => void;
  onClose: () => void;
}

const FORMULA_LABELS: Record<OneRmFormula, string> = {
  epley: 'Еплі',
  brzycki: 'Бжицькі',
  lombardi: 'Ломбарді',
  average: 'Середня',
};

const INTENSITY_ZONES = [
  { pct: 100, targetReps: 1, goal: 'Піковий максимум' },
  { pct: 95, targetReps: 2, goal: 'Максимальна сила' },
  { pct: 90, targetReps: 4, goal: 'Сила' },
  { pct: 85, targetReps: 6, goal: 'Сила та маса' },
  { pct: 80, targetReps: 8, goal: 'Гіпертрофія' },
  { pct: 75, targetReps: 10, goal: 'Гіпертрофія' },
  { pct: 70, targetReps: 12, goal: 'Силова витривалість' },
  { pct: 60, targetReps: 15, goal: 'Розминка / техніка' },
];

export const OneRepMaxModal: React.FC<OneRepMaxModalProps> = ({
  initialWeightKg = 80,
  initialReps = 5,
  exerciseName,
  canApplyToExercise = false,
  onApplyWorkingSet,
  onClose,
}) => {
  const [weightKg, setWeightKg] = useState<number>(
    initialWeightKg > 0 ? initialWeightKg : 60
  );
  const [reps, setReps] = useState<number>(
    initialReps > 0 ? Math.min(30, initialReps) : 5
  );
  const [formula, setFormula] = useState<OneRmFormula>('epley');
  const [appliedPct, setAppliedPct] = useState<number | null>(null);

  const epley = useMemo(() => calculateEpley1RM(weightKg, reps), [weightKg, reps]);
  const brzycki = useMemo(() => calculateBrzycki1RM(weightKg, reps), [weightKg, reps]);
  const lombardi = useMemo(() => calculateLombardi1RM(weightKg, reps), [weightKg, reps]);
  const activeOneRm = useMemo(
    () => calculateOneRm(weightKg, reps, formula),
    [weightKg, reps, formula]
  );

  const handleApply = (pct: number, workingWeightKg: number, targetReps: number) => {
    if (!onApplyWorkingSet) return;
    onApplyWorkingSet(workingWeightKg, targetReps);
    setAppliedPct(pct);
    window.setTimeout(() => {
      onClose();
    }, 280);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-950/60 dark:bg-slate-950/75 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="one-rm-modal-title"
    >
      <div className="w-full sm:max-w-xl max-h-[90vh] bg-[var(--bg-surface)] rounded-t-3xl sm:rounded-2xl border border-[var(--border-subtle)] shadow-2xl flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-medium text-orange-700 dark:text-orange-400">
              <Calculator className="w-3.5 h-3.5 shrink-0" />
              <span>Калькулятор силового максимуму</span>
            </div>
            <h2
              id="one-rm-modal-title"
              className="mt-0.5 text-xl font-semibold tracking-tight text-[var(--text-primary)] truncate"
            >
              {exerciseName ? `1ПМ: ${exerciseName}` : 'Розрахунок 1ПМ'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Закрити калькулятор 1ПМ"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* Weight and Reps Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="one-rm-weight"
                className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
              >
                Робоча вага (кг)
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setWeightKg((w) => Math.max(0, Math.round((w - 2.5) * 10) / 10))}
                  aria-label="Зменшити вагу на 2.5 кг"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface-subtle)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] transition-colors shrink-0"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  id="one-rm-weight"
                  type="number"
                  min={0}
                  max={600}
                  step={2.5}
                  value={weightKg}
                  onChange={(e) => setWeightKg(Math.max(0, Number(e.target.value)))}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-center font-mono text-base font-semibold tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-orange-600"
                />
                <button
                  type="button"
                  onClick={() => setWeightKg((w) => Math.round((w + 2.5) * 10) / 10)}
                  aria-label="Збільшити вагу на 2.5 кг"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface-subtle)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] transition-colors shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="one-rm-reps"
                className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
              >
                Кількість повторень
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setReps((r) => Math.max(1, r - 1))}
                  aria-label="Зменшити повторення на 1"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface-subtle)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] transition-colors shrink-0"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  id="one-rm-reps"
                  type="number"
                  min={1}
                  max={30}
                  step={1}
                  value={reps}
                  onChange={(e) =>
                    setReps(Math.min(30, Math.max(1, Math.round(Number(e.target.value) || 1))))
                  }
                  className="w-full min-h-[44px] px-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-center font-mono text-base font-semibold tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-orange-600"
                />
                <button
                  type="button"
                  onClick={() => setReps((r) => Math.min(30, r + 1))}
                  aria-label="Збільшити повторення на 1"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface-subtle)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] transition-colors shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Formula Selector */}
          <div>
            <span className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
              Формула розрахунку
            </span>
            <div className="grid grid-cols-4 gap-1 p-1 bg-[var(--bg-surface-muted)] rounded-xl">
              {(Object.keys(FORMULA_LABELS) as OneRmFormula[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFormula(key)}
                  className={`min-h-[40px] px-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                    formula === key
                      ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {FORMULA_LABELS[key]}
                </button>
              ))}
            </div>
          </div>

          {/* Primary 1RM Readout */}
          <div className="p-5 rounded-2xl bg-slate-900 dark:bg-slate-800/90 border border-slate-800 dark:border-slate-700 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-slate-400">
                Теоретичний максимум (1ПМ)
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-4xl font-mono font-semibold tabular-nums text-white">
                  {activeOneRm}
                </span>
                <span className="text-base text-slate-300">кг</span>
              </div>
            </div>

            <div className="text-xs text-slate-300 space-y-1 font-mono tabular-nums sm:text-right">
              <div>
                <span className="text-slate-400 font-sans">Еплі: </span>
                <span>{epley} кг</span>
              </div>
              <div>
                <span className="text-slate-400 font-sans">Бжицькі: </span>
                <span>{brzycki} кг</span>
              </div>
              <div>
                <span className="text-slate-400 font-sans">Ломбарді: </span>
                <span>{lombardi} кг</span>
              </div>
            </div>
          </div>

          {/* Intensity Zones Table */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Робочі ваги за відсотком від 1ПМ
              </h3>
              <span className="text-xs text-[var(--text-muted)]">
                Округлення до 2.5 кг
              </span>
            </div>

            <div className="border border-[var(--border-subtle)] rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-xs font-semibold text-[var(--text-muted)]">
                    <th className="py-2.5 px-3.5">%</th>
                    <th className="py-2.5 px-3">Зона</th>
                    <th className="py-2.5 px-3 text-right">Повт.</th>
                    <th className="py-2.5 px-3.5 text-right">Вага</th>
                    {canApplyToExercise && <th className="py-2.5 px-3 text-right">Дія</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)] text-sm">
                  {INTENSITY_ZONES.map((zone) => {
                    const exactKg = Math.round(((activeOneRm * zone.pct) / 100) * 10) / 10;
                    const plateKg = roundToPlateKg(exactKg, 2.5);
                    const isApplied = appliedPct === zone.pct;

                    return (
                      <tr key={zone.pct} className="hover:bg-[var(--bg-surface-subtle)] transition-colors">
                        <td className="py-2.5 px-3.5 font-mono font-semibold tabular-nums text-[var(--text-primary)]">
                          {zone.pct}%
                        </td>
                        <td className="py-2.5 px-3 text-xs text-[var(--text-secondary)]">
                          {zone.goal}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[var(--text-secondary)]">
                          ~{zone.targetReps}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-mono tabular-nums">
                          <span className="font-semibold text-[var(--text-primary)]">{plateKg} кг</span>
                          {Math.abs(plateKg - exactKg) >= 0.3 && (
                            <span className="ml-1 text-[11px] text-[var(--text-muted)]">
                              ({exactKg})
                            </span>
                          )}
                        </td>
                        {canApplyToExercise && (
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleApply(zone.pct, plateKg, zone.targetReps)}
                              className={`min-h-[36px] px-2.5 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1 whitespace-nowrap ${
                                isApplied
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-[var(--bg-surface-muted)] hover:bg-orange-600 hover:text-white text-[var(--text-primary)]'
                              }`}
                            >
                              {isApplied && <Check className="w-3.5 h-3.5" />}
                              Підставити
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2 text-sm font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 transition-colors whitespace-nowrap"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
};
