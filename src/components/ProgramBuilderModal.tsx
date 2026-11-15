import React, { useState } from 'react';
import { Copy, X } from 'lucide-react';
import {
  ProgramWeekSchedule,
  TrainingProgram,
  WeekdayIndex,
  WorkoutTemplate,
} from '../types/workout';
import {
  CATEGORY_LABELS,
  PROGRAM_WEEKDAYS,
  getWeekStartMonday,
} from '../utils/workoutStats';

interface ProgramBuilderModalProps {
  initialProgram?: TrainingProgram | null;
  templates: WorkoutTemplate[];
  todayDate: string;
  onSave: (program: TrainingProgram) => void;
  onClose: () => void;
}

function createEmptyWeek(weekNumber: number): ProgramWeekSchedule {
  return {
    weekNumber,
    focusNote: '',
    days: {
      0: null,
      1: null,
      2: null,
      3: null,
      4: null,
      5: null,
      6: null,
    },
  };
}

export const ProgramBuilderModal: React.FC<ProgramBuilderModalProps> = ({
  initialProgram,
  templates,
  todayDate,
  onSave,
  onClose,
}) => {
  const isEditing = Boolean(initialProgram);

  const [title, setTitle] = useState(initialProgram?.title ?? '');
  const [description, setDescription] = useState(initialProgram?.description ?? '');
  const [durationWeeks, setDurationWeeks] = useState<number>(
    initialProgram?.durationWeeks ?? 4
  );
  const [weeks, setWeeks] = useState<ProgramWeekSchedule[]>(() => {
    if (initialProgram?.weeks && initialProgram.weeks.length > 0) {
      return initialProgram.weeks.map((w) => ({
        ...w,
        days: { ...w.days },
      }));
    }
    return Array.from({ length: 4 }, (_, i) => createEmptyWeek(i + 1));
  });
  const [activeWeekIdx, setActiveWeekIdx] = useState<number>(0);
  const [activateOnSave, setActivateOnSave] = useState<boolean>(
    initialProgram?.isActive ?? true
  );
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedNotice, setCopiedNotice] = useState(false);

  const handleDurationChange = (nextWeeksCount: number) => {
    const clamped = Math.min(12, Math.max(1, nextWeeksCount));
    setDurationWeeks(clamped);
    setWeeks((prev) => {
      if (clamped === prev.length) return prev;
      if (clamped < prev.length) {
        return prev.slice(0, clamped);
      }
      const additions = Array.from(
        { length: clamped - prev.length },
        (_, i) => createEmptyWeek(prev.length + i + 1)
      );
      return [...prev, ...additions];
    });
    setActiveWeekIdx((idx) => Math.min(idx, clamped - 1));
  };

  const currentWeek = weeks[activeWeekIdx] ?? weeks[0];

  const updateDayTemplate = (dayIdx: WeekdayIndex, templateId: string | null) => {
    setWeeks((prev) =>
      prev.map((w, idx) =>
        idx === activeWeekIdx
          ? {
              ...w,
              days: {
                ...w.days,
                [dayIdx]: templateId,
              },
            }
          : w
      )
    );
  };

  const updateWeekFocus = (note: string) => {
    setWeeks((prev) =>
      prev.map((w, idx) => (idx === activeWeekIdx ? { ...w, focusNote: note } : w))
    );
  };

  const copyWeekToAll = () => {
    if (!currentWeek) return;
    setWeeks((prev) =>
      prev.map((w) => ({
        ...w,
        days: { ...currentWeek.days },
      }))
    );
    setCopiedNotice(true);
    window.setTimeout(() => setCopiedNotice(false), 2400);
  };

  const handleSubmit = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMsg('Вкажіть назву тренувальної програми.');
      return;
    }

    const program: TrainingProgram = {
      id: initialProgram?.id ?? `prog-${Date.now()}`,
      title: trimmedTitle,
      description:
        description.trim() ||
        `Послідовна програма на ${durationWeeks} тиж. із запланованими тренуваннями.`,
      durationWeeks,
      startDate: activateOnSave
        ? initialProgram?.startDate ?? getWeekStartMonday(todayDate)
        : initialProgram?.startDate,
      isActive: activateOnSave,
      weeks: weeks.map((w, i) => ({
        ...w,
        weekNumber: i + 1,
        focusNote: w.focusNote?.trim() || undefined,
      })),
    };

    onSave(program);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/55 dark:bg-slate-950/75 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="program-modal-title"
    >
      <div className="w-full sm:max-w-3xl max-h-[92vh] bg-[var(--bg-surface)] rounded-t-3xl sm:rounded-2xl border border-[var(--border-subtle)] shadow-2xl flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between gap-4 shrink-0">
          <h2
            id="program-modal-title"
            className="text-xl font-semibold tracking-tight text-[var(--text-primary)]"
          >
            {isEditing
              ? 'Редагувати тренувальну програму'
              : 'Нова багатотижнева програма'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрити конструктор програм"
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label
                htmlFor="prog-title"
                className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
              >
                Назва програми
              </label>
              <input
                id="prog-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Наприклад: 4-тижневий спліт верх/низ"
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-orange-600"
              />
            </div>

            <div>
              <label
                htmlFor="prog-weeks"
                className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
              >
                Тривалість (тижнів)
              </label>
              <select
                id="prog-weeks"
                value={durationWeeks}
                onChange={(e) => handleDurationChange(Number(e.target.value))}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] font-mono text-sm font-semibold text-[var(--text-primary)] focus:outline-none focus:border-orange-600"
              >
                {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? 'тиждень' : n <= 4 ? 'тижні' : 'тижнів'}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor="prog-desc"
                className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
              >
                Опис та мета циклу
              </label>
              <input
                id="prog-desc"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Короткий опис структури програми..."
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-orange-600"
              />
            </div>
          </div>

          {/* Week Switcher & Day Assignments */}
          <div className="pt-4 border-t border-[var(--border-subtle)] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {weeks.map((w, idx) => (
                  <button
                    key={w.weekNumber}
                    type="button"
                    onClick={() => setActiveWeekIdx(idx)}
                    className={`min-h-[38px] px-3 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap ${
                      activeWeekIdx === idx
                        ? 'bg-slate-900 dark:bg-orange-600 text-white'
                        : 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    Тиждень {w.weekNumber}
                  </button>
                ))}
              </div>

              {weeks.length > 1 && (
                <button
                  type="button"
                  onClick={copyWeekToAll}
                  className="min-h-[38px] px-3 text-xs font-semibold rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Copy className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                  {copiedNotice
                    ? 'Скопійовано на всі тижні'
                    : 'Копіювати графік на всі тижні'}
                </button>
              )}
            </div>

            {currentWeek && (
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="week-focus-note"
                    className="block text-xs font-semibold text-[var(--text-secondary)] mb-1"
                  >
                    Фокус тижня {currentWeek.weekNumber} (необов&apos;язково)
                  </label>
                  <input
                    id="week-focus-note"
                    type="text"
                    value={currentWeek.focusNote ?? ''}
                    onChange={(e) => updateWeekFocus(e.target.value)}
                    placeholder="Наприклад: Робочий об'єм або Розвантаження"
                    className="w-full min-h-[40px] px-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-orange-600"
                  />
                </div>

                <div className="divide-y divide-[var(--border-subtle)] border border-[var(--border-subtle)] rounded-xl overflow-hidden">
                  {PROGRAM_WEEKDAYS.map((wd) => {
                    const selectedTplId = currentWeek.days[wd.index] ?? '';
                    const selectedTpl = templates.find((t) => t.id === selectedTplId);

                    return (
                      <div
                        key={wd.index}
                        className="px-4 py-3 bg-[var(--bg-surface)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                      >
                        <div className="flex items-center gap-3 min-w-[140px]">
                          <span className="w-7 text-xs font-mono font-semibold text-[var(--text-muted)]">
                            {wd.short}
                          </span>
                          <span className="text-sm font-semibold text-[var(--text-primary)]">
                            {wd.full}
                          </span>
                        </div>

                        <div className="flex-1 flex items-center gap-3">
                          <select
                            value={selectedTplId}
                            onChange={(e) =>
                              updateDayTemplate(
                                wd.index,
                                e.target.value ? e.target.value : null
                              )
                            }
                            aria-label={`Тренування на ${wd.full}`}
                            className="w-full min-h-[42px] px-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-orange-600"
                          >
                            <option value="">День відпочинку</option>
                            {templates.map((tpl) => (
                              <option key={tpl.id} value={tpl.id}>
                                {tpl.title} ({CATEGORY_LABELS[tpl.category]} · ~{tpl.estimatedMinutes} хв)
                              </option>
                            ))}
                          </select>
                        </div>

                        {selectedTpl && (
                          <span className="hidden md:inline-block text-xs font-mono tabular-nums text-[var(--text-muted)] whitespace-nowrap">
                            {selectedTpl.exercises.length} впр.
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <label className="flex items-center gap-3 pt-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={activateOnSave}
              onChange={(e) => setActivateOnSave(e.target.checked)}
              className="w-4 h-4 accent-orange-600 rounded"
            />
            <span className="text-sm font-medium text-[var(--text-primary)]">
              Зробити активною програмою на поточний тиждень
            </span>
          </label>
        </div>

        <div className="px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] flex flex-wrap items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 text-sm font-medium rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-surface-muted)] transition-colors whitespace-nowrap"
          >
            Скасувати
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="min-h-[44px] px-5 py-2 text-sm font-semibold rounded-xl bg-orange-600 hover:bg-orange-700 text-white transition-colors whitespace-nowrap"
          >
            {isEditing ? 'Зберегти програму' : 'Створити програму'}
          </button>
        </div>
      </div>
    </div>
  );
};
