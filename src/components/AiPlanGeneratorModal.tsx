import React, { useState } from 'react';
import {
  CalendarCheck,
  Check,
  Loader2,
  Play,
  RotateCcw,
  Wand2,
  X,
} from 'lucide-react';
import {
  AiEquipmentId,
  AiExperienceLevel,
  AiGeneratedPlan,
  AiWorkoutGoal,
  ProgramWeekSchedule,
  TrainingProgram,
  WeekdayIndex,
  WorkoutTemplate,
} from '../types/workout';
import {
  CATEGORY_ACCENTS,
  CATEGORY_LABELS,
  PROGRAM_WEEKDAYS,
  getWeekStartMonday,
} from '../utils/workoutStats';

interface AiPlanGeneratorModalProps {
  todayDate: string;
  hasActiveLive: boolean;
  onSaveProgramPlan: (
    program: TrainingProgram,
    newTemplates: WorkoutTemplate[]
  ) => void;
  onStartTemplateLive: (template: WorkoutTemplate) => void;
  onClose: () => void;
}

const GOALS: { id: AiWorkoutGoal; title: string; subtitle: string }[] = [
  {
    id: 'fat_loss',
    title: 'Схуднення',
    subtitle: 'Метаболічні тренування, кардіо та підтримка м’язів',
  },
  {
    id: 'muscle_gain',
    title: "Набір м'язової маси",
    subtitle: 'Гіпертрофія 8–12 повторів, баланс груп м’язів',
  },
  {
    id: 'strength',
    title: 'Максимальна сила',
    subtitle: 'Базові вправи, важкі підходи, довший відпочинок',
  },
  {
    id: 'endurance',
    title: 'Витривалість',
    subtitle: 'Аеробна база, темпові та інтервальні блоки',
  },
  {
    id: 'mobility',
    title: 'Мобільність і тонус',
    subtitle: 'Суглобова рухливість, кор, постава та легка сила',
  },
];

const EQUIPMENT_OPTIONS: { id: AiEquipmentId; label: string }[] = [
  { id: 'bodyweight', label: 'Власна вага' },
  { id: 'dumbbells', label: 'Гантелі' },
  { id: 'barbell', label: 'Штанга та лава' },
  { id: 'machines', label: 'Тренажери залу' },
  { id: 'pullup_bar', label: 'Турнік / бруси' },
  { id: 'kettlebell', label: 'Гирі' },
  { id: 'bands', label: 'Фітнес-гумки' },
  { id: 'cardio_machine', label: 'Бігова / велотренажер' },
];

const EXPERIENCE_OPTIONS: { id: AiExperienceLevel; label: string }[] = [
  { id: 'beginner', label: 'Початківець' },
  { id: 'intermediate', label: 'Середній' },
  { id: 'advanced', label: 'Просунутий' },
];

export const AiPlanGeneratorModal: React.FC<AiPlanGeneratorModalProps> = ({
  todayDate,
  hasActiveLive,
  onSaveProgramPlan,
  onStartTemplateLive,
  onClose,
}) => {
  const [goal, setGoal] = useState<AiWorkoutGoal>('muscle_gain');
  const [equipment, setEquipment] = useState<AiEquipmentId[]>([
    'dumbbells',
    'pullup_bar',
    'bodyweight',
  ]);
  const [daysPerWeek, setDaysPerWeek] = useState<number>(4);
  const [durationMinutes, setDurationMinutes] = useState<number>(45);
  const [experienceLevel, setExperienceLevel] =
    useState<AiExperienceLevel>('intermediate');
  const [programWeeks, setProgramWeeks] = useState<number>(4);
  const [notes, setNotes] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [generatedPlan, setGeneratedPlan] = useState<AiGeneratedPlan | null>(
    null
  );

  const toggleEquipment = (id: AiEquipmentId) => {
    setEquipment((prev) => {
      if (prev.includes(id)) {
        return prev.length > 1 ? prev.filter((item) => item !== id) : prev;
      }
      return [...prev, id];
    });
  };

  const handleGenerate = async () => {
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal,
          equipment,
          daysPerWeek,
          durationMinutes,
          experienceLevel,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setErrorMsg(
          typeof data?.error === 'string'
            ? data.error
            : 'Не вдалося згенерувати план тренувань.'
        );
        return;
      }

      setGeneratedPlan(data as AiGeneratedPlan);
    } catch {
      setErrorMsg(
        'Помилка мережі при зверненні до сервера. Перевірте підключення та спробуйте ще раз.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAsProgram = () => {
    if (!generatedPlan) return;

    const newTemplates: WorkoutTemplate[] = [];
    const baseDays: Record<WeekdayIndex, string | null> = {
      0: null,
      1: null,
      2: null,
      3: null,
      4: null,
      5: null,
      6: null,
    };

    for (const day of generatedPlan.days) {
      if (!day.isRestDay && day.template) {
        newTemplates.push(day.template);
        baseDays[day.weekdayIndex] = day.template.id;
      }
    }

    const weeks: ProgramWeekSchedule[] = Array.from(
      { length: programWeeks },
      (_, idx) => ({
        weekNumber: idx + 1,
        focusNote:
          idx === 0
            ? 'Адаптація та техніка'
            : idx === programWeeks - 1 && programWeeks >= 4
              ? 'Закріплення результату та відновлення'
              : 'Поступова прогресія навантаження',
        days: { ...baseDays },
      })
    );

    const newProgram: TrainingProgram = {
      id: `prog-ai-${Date.now()}`,
      title: generatedPlan.planTitle,
      description: generatedPlan.planSummary,
      durationWeeks: programWeeks,
      startDate: getWeekStartMonday(todayDate),
      isActive: true,
      weeks,
    };

    onSaveProgramPlan(newProgram, newTemplates);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/55 dark:bg-slate-950/75 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-plan-modal-title"
    >
      <div className="w-full sm:max-w-3xl max-h-[92vh] bg-[var(--bg-surface)] rounded-t-3xl sm:rounded-2xl border border-[var(--border-subtle)] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <Wand2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="ai-plan-modal-title"
                className="text-xl font-semibold tracking-tight text-[var(--text-primary)] truncate"
              >
                Генератор плану тренувань (ШІ)
              </h2>
              <p className="text-xs text-[var(--text-muted)] truncate">
                Персональний тижневий розклад під вашу мету та доступний інвентар
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Закрити генератор плану"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 text-sm text-rose-700 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          {!generatedPlan ? (
            <div className="space-y-6">
              {/* Goal selection */}
              <div className="space-y-2.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  1. Головна мета тренувань
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {GOALS.map((g) => {
                    const active = goal === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setGoal(g.id)}
                        className={`min-h-[56px] px-4 py-3 rounded-xl border text-left transition-colors ${
                          active
                            ? 'bg-slate-900 dark:bg-orange-600 text-white border-slate-900 dark:border-orange-500'
                            : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:bg-[var(--bg-surface-subtle)]'
                        }`}
                      >
                        <div className="text-sm font-semibold">{g.title}</div>
                        <div
                          className={`mt-0.5 text-xs ${
                            active ? 'text-slate-300 dark:text-orange-100' : 'text-[var(--text-muted)]'
                          }`}
                        >
                          {g.subtitle}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Equipment selection */}
              <div className="pt-4 border-t border-[var(--border-subtle)] space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    2. Доступне обладнання
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEquipment(['bodyweight'])}
                      className="px-2.5 py-1 text-xs font-medium rounded-lg bg-[var(--bg-surface-muted)] hover:bg-slate-200 dark:hover:bg-slate-700 text-[var(--text-secondary)] transition-colors"
                    >
                      Лише вдома
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEquipment(['bodyweight', 'dumbbells', 'pullup_bar'])
                      }
                      className="px-2.5 py-1 text-xs font-medium rounded-lg bg-[var(--bg-surface-muted)] hover:bg-slate-200 dark:hover:bg-slate-700 text-[var(--text-secondary)] transition-colors"
                    >
                      Гантелі + турнік
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEquipment([
                          'bodyweight',
                          'dumbbells',
                          'barbell',
                          'machines',
                          'pullup_bar',
                          'cardio_machine',
                        ])
                      }
                      className="px-2.5 py-1 text-xs font-medium rounded-lg bg-[var(--bg-surface-muted)] hover:bg-slate-200 dark:hover:bg-slate-700 text-[var(--text-secondary)] transition-colors"
                    >
                      Повний зал
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {EQUIPMENT_OPTIONS.map((item) => {
                    const checked = equipment.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleEquipment(item.id)}
                        className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 transition-colors text-left ${
                          checked
                            ? 'bg-orange-50 dark:bg-orange-950/50 border-orange-600 dark:border-orange-500 text-orange-950 dark:text-orange-100'
                            : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)]'
                        }`}
                      >
                        <span>{item.label}</span>
                        {checked && (
                          <Check className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Frequency, Duration, Experience */}
              <div className="pt-4 border-t border-[var(--border-subtle)] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label
                    htmlFor="ai-days"
                    className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
                  >
                    Тренувань на тиждень
                  </label>
                  <select
                    id="ai-days"
                    value={daysPerWeek}
                    onChange={(e) => setDaysPerWeek(Number(e.target.value))}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] font-mono text-sm font-semibold text-[var(--text-primary)] focus:outline-none focus:border-orange-600"
                  >
                    {[2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n} дн. / тиждень
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="ai-duration"
                    className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
                  >
                    Тривалість сесії
                  </label>
                  <select
                    id="ai-duration"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] font-mono text-sm font-semibold text-[var(--text-primary)] focus:outline-none focus:border-orange-600"
                  >
                    {[25, 40, 45, 55, 70].map((m) => (
                      <option key={m} value={m}>
                        ~{m} хв
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="ai-level"
                    className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
                  >
                    Рівень підготовки
                  </label>
                  <select
                    id="ai-level"
                    value={experienceLevel}
                    onChange={(e) =>
                      setExperienceLevel(e.target.value as AiExperienceLevel)
                    }
                    className="w-full min-h-[44px] px-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-sm font-semibold text-[var(--text-primary)] focus:outline-none focus:border-orange-600"
                  >
                    {EXPERIENCE_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="ai-weeks"
                    className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
                  >
                    Цикл програми
                  </label>
                  <select
                    id="ai-weeks"
                    value={programWeeks}
                    onChange={(e) => setProgramWeeks(Number(e.target.value))}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] font-mono text-sm font-semibold text-[var(--text-primary)] focus:outline-none focus:border-orange-600"
                  >
                    {[2, 4, 6, 8].map((w) => (
                      <option key={w} value={w}>
                        {w} {w <= 4 ? 'тижні' : 'тижнів'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="ai-notes"
                  className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
                >
                  Додаткові побажання або обмеження (необов&apos;язково)
                </label>
                <input
                  id="ai-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Наприклад: без ударного навантаження на коліна, акцент на спину та плечі"
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-orange-600"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Plan Summary */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-orange-700 dark:text-orange-400">
                      Згенеровано ШІ · {daysPerWeek} трен./тиж · ~{durationMinutes} хв
                    </div>
                    <h3 className="mt-0.5 text-lg font-semibold text-[var(--text-primary)]">
                      {generatedPlan.planTitle}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => setGeneratedPlan(null)}
                    className="min-h-[40px] px-3.5 text-xs font-semibold rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Змінити параметри
                  </button>
                </div>

                <p className="text-sm text-[var(--text-secondary)]">{generatedPlan.planSummary}</p>

                {generatedPlan.weeklyTips.length > 0 && (
                  <ul className="pt-2 space-y-1 text-xs text-[var(--text-secondary)] list-disc pl-4">
                    {generatedPlan.weeklyTips.map((tip, idx) => (
                      <li key={idx}>{tip}</li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Generated 7-Day Schedule */}
              <div className="border border-[var(--border-subtle)] rounded-2xl divide-y divide-[var(--border-subtle)] overflow-hidden">
                {generatedPlan.days.map((day) => {
                  const wd = PROGRAM_WEEKDAYS[day.weekdayIndex];
                  const tpl = day.template;

                  return (
                    <div key={day.weekdayIndex} className="p-4 bg-[var(--bg-surface)]">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--text-muted)]">
                            <span className="font-mono font-semibold text-[var(--text-secondary)]">
                              {wd.full}
                            </span>
                            {tpl ? (
                              <>
                                <span aria-hidden="true">·</span>
                                <span
                                  className={`font-semibold ${CATEGORY_ACCENTS[tpl.category]}`}
                                >
                                  {CATEGORY_LABELS[tpl.category]}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums">
                                  ~{tpl.estimatedMinutes} хв
                                </span>
                              </>
                            ) : (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>Відновлення</span>
                              </>
                            )}
                          </div>

                          <h4 className="mt-0.5 text-base font-semibold text-[var(--text-primary)]">
                            {tpl ? tpl.title : 'День відпочинку'}
                          </h4>
                          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                            {tpl ? tpl.description : day.restNote}
                          </p>
                        </div>

                        {tpl && (
                          <button
                            type="button"
                            disabled={hasActiveLive}
                            onClick={() => {
                              onStartTemplateLive(tpl);
                              onClose();
                            }}
                            className="min-h-[40px] px-3.5 text-xs font-semibold rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] hover:bg-slate-900 dark:hover:bg-orange-600 hover:text-white hover:border-slate-900 dark:hover:border-orange-500 disabled:opacity-50 text-[var(--text-primary)] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                          >
                            <Play className="w-3.5 h-3.5" />
                            {hasActiveLive ? 'Сесія триває' : 'Запустити зараз'}
                          </button>
                        )}
                      </div>

                      {tpl && tpl.exercises.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-[var(--border-subtle)] space-y-1.5">
                          {tpl.exercises.map((ex, i) => {
                            const firstSet = ex.sets[0];
                            const detail =
                              ex.trackingType === 'strength'
                                ? `${ex.sets.length} × ${firstSet?.reps ?? 10} повт.${
                                    firstSet && firstSet.weightKg > 0
                                      ? ` (${firstSet.weightKg} кг)`
                                      : ''
                                  }`
                                : ex.trackingType === 'cardio'
                                  ? `${firstSet?.distanceKm ?? 3} км · ${Math.round(
                                      (firstSet?.durationSec ?? 1200) / 60
                                    )} хв`
                                  : `${ex.sets.length} × ${Math.round(
                                      (firstSet?.durationSec ?? 60) / 60 || 1
                                    )} хв`;

                            return (
                              <div
                                key={`${ex.name}-${i}`}
                                className="flex flex-wrap items-center justify-between gap-2 text-xs"
                              >
                                <span className="font-medium text-[var(--text-primary)]">
                                  {i + 1}. {ex.name}{' '}
                                  <span className="text-[var(--text-muted)]">
                                    ({ex.muscleGroup})
                                  </span>
                                </span>
                                <span className="font-mono tabular-nums text-[var(--text-secondary)]">
                                  {detail} · відп. {ex.restSeconds ?? 60}с
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] flex flex-wrap items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 text-sm font-medium rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-surface-muted)] transition-colors whitespace-nowrap"
          >
            Закрити
          </button>

          {!generatedPlan ? (
            <button
              type="button"
              disabled={isLoading}
              onClick={handleGenerate}
              className="min-h-[44px] px-5 py-2.5 text-sm font-semibold rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-70 text-white transition-colors inline-flex items-center gap-2 whitespace-nowrap"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Генеруємо план...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  Згенерувати план
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSaveAsProgram}
              className="min-h-[44px] px-5 py-2.5 text-sm font-semibold rounded-xl bg-orange-600 hover:bg-orange-700 text-white transition-colors inline-flex items-center gap-2 whitespace-nowrap"
            >
              <CalendarCheck className="w-4 h-4" />
              Зберегти як активну програму ({programWeeks} тиж.)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
