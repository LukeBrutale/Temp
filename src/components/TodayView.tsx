import React, { useState } from 'react';
import {
  CalendarPlus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Edit3,
  Play,
  Plus,
  Trash2,
  Wand2,
} from 'lucide-react';
import {
  WeeklyGoals,
  WorkoutSession,
  WorkoutTemplate,
} from '../types/workout';
import {
  CATEGORY_ACCENTS,
  CATEGORY_LABELS,
  ScheduledProgramDay,
  addDays,
  estimateSessionCalories,
  formatNumberUk,
  formatUkDateLong,
  getCompletedSetsCount,
  getSessionDistanceKm,
  getSessionVolumeKg,
  getWeekDays,
  getWeekStartMonday,
} from '../utils/workoutStats';
import { CalendarSyncModal } from './CalendarSyncModal';
import { SvgProgressRing } from './SvgProgressRing';

interface TodayViewProps {
  todayDate: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  sessions: WorkoutSession[];
  goals: WeeklyGoals;
  streakDays: number;
  templates: WorkoutTemplate[];
  scheduledProgramDay?: ScheduledProgramDay | null;
  hasActiveLive: boolean;
  onOpenNewWorkout: () => void;
  onEditWorkout: (session: WorkoutSession) => void;
  onDeleteWorkout: (id: string) => void;
  onDuplicateWorkout: (session: WorkoutSession) => void;
  onStartTemplateLive: (template: WorkoutTemplate) => void;
  onOpenAiPlanModal: () => void;
  onNotify?: (message: string) => void;
}

export const TodayView: React.FC<TodayViewProps> = ({
  todayDate,
  selectedDate,
  onSelectDate,
  sessions,
  goals,
  streakDays,
  templates,
  scheduledProgramDay,
  hasActiveLive,
  onOpenNewWorkout,
  onEditWorkout,
  onDeleteWorkout,
  onDuplicateWorkout,
  onStartTemplateLive,
  onOpenAiPlanModal,
  onNotify,
}) => {
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [calendarSyncOpen, setCalendarSyncOpen] = useState(false);

  const weekStart = getWeekStartMonday(selectedDate);
  const weekDays = getWeekDays(weekStart);
  const weekEnd = addDays(weekStart, 6);

  const daySessions = sessions.filter(
    (s) => s.date === selectedDate && s.completed
  );
  const weekSessions = sessions.filter(
    (s) => s.completed && s.date >= weekStart && s.date <= weekEnd
  );

  const dayMinutes = daySessions.reduce((acc, s) => acc + s.durationMinutes, 0);
  const dayVolume = daySessions.reduce((acc, s) => acc + getSessionVolumeKg(s), 0);
  const dayCalories = daySessions.reduce(
    (acc, s) => acc + estimateSessionCalories(s),
    0
  );
  const dayDistance = daySessions.reduce(
    (acc, s) => acc + getSessionDistanceKm(s),
    0
  );

  const workoutDatesSet = new Set(
    sessions.filter((s) => s.completed).map((s) => s.date)
  );

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-8">
      {/* Date Selector Bar */}
      <section aria-label="Календар тижня" className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-xs font-medium text-[var(--text-muted)]">
              {selectedDate === todayDate ? 'Сьогоднішня активність' : 'Обраний день'}
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
              {formatUkDateLong(selectedDate)}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onSelectDate(addDays(selectedDate, -7))}
              aria-label="Попередній тиждень"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {selectedDate !== todayDate && (
              <button
                type="button"
                onClick={() => onSelectDate(todayDate)}
                className="min-h-[44px] px-3.5 text-xs font-semibold rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-primary)] transition-colors whitespace-nowrap"
              >
                Сьогодні
              </button>
            )}
            <button
              type="button"
              onClick={() => onSelectDate(addDays(selectedDate, 7))}
              aria-label="Наступний тиждень"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
          {weekDays.map((day) => {
            const isSelected = day.date === selectedDate;
            const isToday = day.date === todayDate;
            const hasWorkouts = workoutDatesSet.has(day.date);

            return (
              <button
                key={day.date}
                type="button"
                onClick={() => onSelectDate(day.date)}
                className={`min-h-[60px] py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-colors border ${
                  isSelected
                    ? 'bg-slate-900 dark:bg-orange-600 text-white border-slate-900 dark:border-orange-500'
                    : isToday
                      ? 'bg-orange-50/70 dark:bg-orange-950/30 text-[var(--text-primary)] border-orange-200 dark:border-orange-800/70 hover:bg-orange-100/70 dark:hover:bg-orange-950/50'
                      : 'bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] border-transparent hover:bg-[var(--bg-surface-muted)]'
                }`}
              >
                <span
                  className={`text-[11px] font-medium ${
                    isSelected ? 'text-slate-300 dark:text-orange-100' : 'text-[var(--text-muted)]'
                  }`}
                >
                  {day.weekdayShort}
                </span>
                <span className="text-base font-mono font-semibold tabular-nums leading-none">
                  {day.dayNumber}
                </span>
                <span
                  className={`h-1 w-4 rounded-full transition-opacity ${
                    hasWorkouts
                      ? isSelected
                        ? 'bg-orange-400 dark:bg-white opacity-100'
                        : 'bg-orange-600 dark:bg-orange-400 opacity-100'
                      : 'opacity-0'
                  }`}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      </section>

      {/* 4-Card Daily & Weekly KPI Strip */}
      <section
        aria-label="Ключові показники"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-4 sm:p-5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--text-muted)] truncate">Час за день</p>
            <p className="mt-1 text-2xl sm:text-3xl font-mono font-semibold tabular-nums text-[var(--text-primary)]">
              {dayMinutes} <span className="text-sm font-sans font-normal text-[var(--text-muted)]">хв</span>
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)] tabular-nums">
              Ціль: {goals.dailyMinutesTarget} хв
            </p>
          </div>
          <SvgProgressRing
            value={dayMinutes}
            max={goals.dailyMinutesTarget}
            label={`Денна ціль часу: ${dayMinutes} з ${goals.dailyMinutesTarget} хвилин`}
          />
        </div>

        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-4 sm:p-5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--text-muted)] truncate">За тиждень</p>
            <p className="mt-1 text-2xl sm:text-3xl font-mono font-semibold tabular-nums text-[var(--text-primary)]">
              {weekSessions.length}
              <span className="text-base font-mono text-[var(--text-muted)]">/{goals.workoutsPerWeek}</span>
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)] tabular-nums">
              {weekSessions.reduce((a, b) => a + b.durationMinutes, 0)} хв разом
            </p>
          </div>
          <SvgProgressRing
            value={weekSessions.length}
            max={goals.workoutsPerWeek}
            label={`Тижнева ціль тренувань: ${weekSessions.length} з ${goals.workoutsPerWeek}`}
          />
        </div>

        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-4 sm:p-5">
          <p className="text-xs font-medium text-[var(--text-muted)] truncate">Об&apos;єм та витрати</p>
          <p className="mt-1 text-2xl sm:text-3xl font-mono font-semibold tabular-nums text-[var(--text-primary)]">
            {dayVolume > 0
              ? formatNumberUk(dayVolume)
              : dayDistance > 0
                ? dayDistance
                : formatNumberUk(dayCalories)}
            <span className="ml-1 text-sm font-sans font-normal text-[var(--text-muted)]">
              {dayVolume > 0 ? 'кг' : dayDistance > 0 ? 'км' : 'ккал'}
            </span>
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)] tabular-nums">
            ~{formatNumberUk(dayCalories)} ккал за день
          </p>
        </div>

        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-4 sm:p-5">
          <p className="text-xs font-medium text-[var(--text-muted)] truncate">Поточна серія</p>
          <p className="mt-1 text-2xl sm:text-3xl font-mono font-semibold tabular-nums text-[var(--text-primary)]">
            {streakDays}
            <span className="ml-1 text-sm font-sans font-normal text-[var(--text-muted)]">
              {streakDays === 1 ? 'день' : streakDays >= 2 && streakDays <= 4 ? 'дні' : 'днів'}
            </span>
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {streakDays > 0 ? 'Безперервний ритм' : 'Почніть нову серію сьогодні'}
          </p>
        </div>
      </section>

      {/* Active Multi-Week Program Schedule for Selected Date */}
      {scheduledProgramDay && (
        <section
          aria-label="План за програмою"
          className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-muted)]">
              <span className="font-semibold text-orange-700 dark:text-orange-400">
                План за програмою
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-[var(--text-secondary)]">
                {scheduledProgramDay.program.title}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                Тиждень {scheduledProgramDay.weekNumber} з{' '}
                {scheduledProgramDay.program.durationWeeks}
              </span>
              {scheduledProgramDay.focusNote && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{scheduledProgramDay.focusNote}</span>
                </>
              )}
            </div>

            {scheduledProgramDay.template ? (
              <>
                <h3 className="mt-1.5 text-lg font-semibold text-[var(--text-primary)]">
                  {scheduledProgramDay.template.title}
                </h3>
                <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
                  <span
                    className={`font-semibold ${
                      CATEGORY_ACCENTS[scheduledProgramDay.template.category]
                    }`}
                  >
                    {CATEGORY_LABELS[scheduledProgramDay.template.category]}
                  </span>
                  <span className="mx-1.5 text-[var(--text-muted)]" aria-hidden="true">
                    ·
                  </span>
                  <span className="font-mono tabular-nums">
                    ~{scheduledProgramDay.template.estimatedMinutes} хв
                  </span>
                  <span className="mx-1.5 text-[var(--text-muted)]" aria-hidden="true">
                    ·
                  </span>
                  <span>
                    {scheduledProgramDay.template.exercises.length} впр.
                  </span>
                  <span className="mx-1.5 text-[var(--text-muted)]" aria-hidden="true">
                    —
                  </span>
                  <span>{scheduledProgramDay.template.description}</span>
                </p>
              </>
            ) : (
              <>
                <h3 className="mt-1.5 text-lg font-semibold text-[var(--text-primary)]">
                  День відпочинку та відновлення
                </h3>
                <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
                  За активною програмою на цей день не заплановано силових чи кардіо сесій. За бажанням можете додати легку мобільність.
                </p>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setCalendarSyncOpen(true)}
              className="min-h-[44px] px-3.5 py-2 text-sm font-semibold rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <CalendarPlus className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              Календар
            </button>

            {scheduledProgramDay.template && (
              <button
                type="button"
                disabled={hasActiveLive}
                onClick={() => onStartTemplateLive(scheduledProgramDay.template!)}
                className="min-h-[44px] px-4 py-2.5 text-sm font-semibold rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:pointer-events-none text-white transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <Play className="w-4 h-4" />
                {hasActiveLive ? 'Сесія триває' : 'Запустити за планом'}
              </button>
            )}
          </div>
        </section>
      )}

      {/* Today's Logged Workouts */}
      <section aria-label="Тренування за день">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            Записи за {selectedDate === todayDate ? 'сьогодні' : formatUkDateLong(selectedDate)}
          </h3>
          <button
            type="button"
            onClick={onOpenNewWorkout}
            className="min-h-[44px] px-4 py-2 text-sm font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Записати тренування
          </button>
        </div>

        {daySessions.length === 0 ? (
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-8 sm:p-10 text-center">
            <h4 className="text-base font-semibold text-[var(--text-primary)]">
              На цей день тренувань ще немає
            </h4>
            <p className="mt-1.5 text-sm text-[var(--text-muted)] max-w-md mx-auto">
              Додайте виконане тренування вручну або запустіть один із готових шаблонів нижче з живим таймером.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onOpenNewWorkout}
                className="min-h-[44px] px-5 py-2.5 text-sm font-semibold rounded-xl bg-orange-600 hover:bg-orange-700 text-white transition-colors whitespace-nowrap"
              >
                Додати запис
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {daySessions.map((session) => {
              const isExpanded = Boolean(expandedIds[session.id]);
              const vol = getSessionVolumeKg(session);
              const dist = getSessionDistanceKm(session);
              const { done, total } = getCompletedSetsCount(session);

              return (
                <article
                  key={session.id}
                  className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden"
                >
                  <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-muted)]">
                        <span className={`font-semibold ${CATEGORY_ACCENTS[session.category]}`}>
                          {CATEGORY_LABELS[session.category]}
                        </span>
                        {session.startTime && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">{session.startTime}</span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{session.durationMinutes} хв</span>
                        {vol > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              {formatNumberUk(vol)} кг
                            </span>
                          </>
                        )}
                        {dist > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">{dist} км</span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">RPE {session.rpe}/10</span>
                      </div>

                      <h4 className="mt-1 text-lg font-semibold text-[var(--text-primary)] truncate">
                        {session.title}
                      </h4>

                      {session.notes && (
                        <p className="mt-1 text-sm text-[var(--text-secondary)] line-clamp-2">
                          {session.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {session.exercises.length > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(session.id)}
                          className="min-h-[44px] px-3 text-xs font-semibold rounded-xl border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] transition-colors flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <span>
                            {session.exercises.length} впр. ({done}/{total})
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onDuplicateWorkout(session)}
                        title="Повторити на сьогодні"
                        aria-label={`Повторити ${session.title} сьогодні`}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onEditWorkout(session)}
                        title="Редагувати"
                        aria-label={`Редагувати ${session.title}`}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      {confirmDeleteId !== session.id ? (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(session.id)}
                          title="Видалити"
                          aria-label={`Видалити ${session.title}`}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteWorkout(session.id);
                              setConfirmDeleteId(null);
                            }}
                            className="min-h-[44px] px-3 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-colors whitespace-nowrap"
                          >
                            Видалити
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="min-h-[44px] px-2.5 text-xs font-medium rounded-xl bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] transition-colors whitespace-nowrap"
                          >
                            Ні
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {isExpanded && session.exercises.length > 0 && (
                    <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-5 py-4 divide-y divide-[var(--border-subtle)]">
                      {session.exercises.map((ex) => (
                        <div
                          key={ex.id}
                          className="py-2.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                        >
                          <div>
                            <span className="text-sm font-semibold text-[var(--text-primary)]">
                              {ex.name}
                            </span>
                            <span className="ml-2 text-xs text-[var(--text-muted)]">
                              {ex.muscleGroup}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono tabular-nums text-[var(--text-secondary)]">
                            {ex.sets.map((s, idx) => (
                              <span key={s.id}>
                                {ex.trackingType === 'strength'
                                  ? `${idx + 1}: ${s.weightKg} кг × ${s.reps}`
                                  : ex.trackingType === 'cardio'
                                    ? `${s.distanceKm ?? 0} км · ${Math.round((s.durationSec ?? 0) / 60)} хв`
                                    : `${Math.round((s.durationSec ?? 0) / 60)} хв (${s.durationSec ?? 0}с)`}
                                {s.note && (
                                  <span className="font-sans text-[var(--text-muted)]">
                                    {' '}({s.note})
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Quick-Start Templates */}
      <section aria-label="Швидкий старт шаблонів">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
              Швидкий старт за шаблоном
            </h3>
            <p className="text-sm text-[var(--text-muted)]">
              Запустіть готовий комплекс із таймером відпочинку та відстеженням підходів у реальному часі.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenAiPlanModal}
            className="min-h-[44px] px-4 py-2 text-sm font-semibold rounded-xl border border-orange-200 dark:border-orange-800/70 bg-orange-50 dark:bg-orange-950/40 hover:bg-orange-100 dark:hover:bg-orange-950/70 text-orange-800 dark:text-orange-300 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Wand2 className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            Згенерувати план (ШІ)
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.slice(0, 3).map((tpl) => (
            <div
              key={tpl.id}
              className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-5 flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <span className={`font-semibold ${CATEGORY_ACCENTS[tpl.category]}`}>
                    {CATEGORY_LABELS[tpl.category]}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">~{tpl.estimatedMinutes} хв</span>
                  <span aria-hidden="true">·</span>
                  <span>{tpl.exercises.length} впр.</span>
                </div>
                <h4 className="mt-1.5 text-base font-semibold text-[var(--text-primary)]">
                  {tpl.title}
                </h4>
                <p className="mt-1 text-sm text-[var(--text-secondary)] line-clamp-2">
                  {tpl.description}
                </p>
              </div>

              <button
                type="button"
                disabled={hasActiveLive}
                onClick={() => onStartTemplateLive(tpl)}
                className="min-h-[44px] w-full px-4 py-2 text-sm font-semibold rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] hover:bg-slate-900 dark:hover:bg-orange-600 hover:text-white hover:border-slate-900 dark:hover:border-orange-500 disabled:opacity-50 disabled:pointer-events-none text-[var(--text-primary)] transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <Play className="w-4 h-4" />
                {hasActiveLive ? 'Сесія вже триває' : 'Почати тренування'}
              </button>
            </div>
          ))}
        </div>
      </section>
      {calendarSyncOpen && scheduledProgramDay && (
        <CalendarSyncModal
          program={scheduledProgramDay.program}
          templates={templates}
          todayDate={todayDate}
          onNotify={onNotify}
          onClose={() => setCalendarSyncOpen(false)}
        />
      )}
    </div>
  );
};
