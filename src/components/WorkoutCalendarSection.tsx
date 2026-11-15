import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Copy,
  Dumbbell,
  Edit3,
  Play,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  TrainingProgram,
  WorkoutCategory,
  WorkoutSession,
  WorkoutTemplate,
} from '../types/workout';
import {
  CATEGORY_ACCENTS,
  CATEGORY_BAR_COLORS,
  CATEGORY_LABELS,
  addDays,
  formatNumberUk,
  formatUkDateLong,
  formatUkDateShort,
  getScheduledProgramDay,
  getSessionDistanceKm,
  getSessionVolumeKg,
  parseLocalDate,
  toLocalDateString,
} from '../utils/workoutStats';

interface WorkoutCalendarSectionProps {
  sessions: WorkoutSession[];
  activeProgram?: TrainingProgram;
  templates: WorkoutTemplate[];
  todayDate: string;
  hasActiveLive: boolean;
  activeCategoryFilter: 'all' | WorkoutCategory;
  searchQuery: string;
  onOpenNewWorkoutForDate: (date: string) => void;
  onEditWorkout: (session: WorkoutSession) => void;
  onDeleteWorkout: (id: string) => void;
  onDuplicateWorkout: (session: WorkoutSession) => void;
  onStartTemplateLive: (template: WorkoutTemplate) => void;
}

const UK_MONTHS_NOMINATIVE = [
  'Січень',
  'Лютий',
  'Березень',
  'Квітень',
  'Травень',
  'Червень',
  'Липень',
  'Серпень',
  'Вересень',
  'Жовтень',
  'Листопад',
  'Грудень',
];

const WEEKDAY_HEADERS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

const CATEGORY_SOFT_BG: Record<WorkoutCategory, string> = {
  strength: 'bg-orange-500/12 text-orange-800 dark:text-orange-300 border-orange-500/30',
  cardio: 'bg-sky-500/12 text-sky-800 dark:text-sky-300 border-sky-500/30',
  hiit: 'bg-rose-500/12 text-rose-800 dark:text-rose-300 border-rose-500/30',
  mobility: 'bg-emerald-500/12 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
};

interface CalendarCell {
  date: string;
  dayNumber: number;
  inCurrentMonth: boolean;
}

function buildMonthGridCells(year: number, monthIndex: number): CalendarCell[] {
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);
  const firstWeekdayMon = (firstDay.getDay() + 6) % 7; // 0 = Пн ... 6 = Нд
  const daysInMonth = lastDay.getDate();

  const totalCells = Math.ceil((firstWeekdayMon + daysInMonth) / 7) * 7;
  const gridStartDate = addDays(toLocalDateString(firstDay), -firstWeekdayMon);

  return Array.from({ length: totalCells }, (_, idx) => {
    const date = addDays(gridStartDate, idx);
    const dt = parseLocalDate(date);
    return {
      date,
      dayNumber: dt.getDate(),
      inCurrentMonth: dt.getFullYear() === year && dt.getMonth() === monthIndex,
    };
  });
}

export const WorkoutCalendarSection: React.FC<WorkoutCalendarSectionProps> = ({
  sessions,
  activeProgram,
  templates,
  todayDate,
  hasActiveLive,
  activeCategoryFilter,
  searchQuery,
  onOpenNewWorkoutForDate,
  onEditWorkout,
  onDeleteWorkout,
  onDuplicateWorkout,
  onStartTemplateLive,
}) => {
  const initialDate = useMemo(() => parseLocalDate(todayDate), [todayDate]);
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [selectedModalDate, setSelectedModalDate] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedModalDate) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedModalDate(null);
        setConfirmDeleteId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedModalDate]);

  const matchingCompletedSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sessions
      .filter((s) => s.completed)
      .filter((s) =>
        activeCategoryFilter === 'all' ? true : s.category === activeCategoryFilter
      )
      .filter((s) => {
        if (!q) return true;
        if (s.title.toLowerCase().includes(q)) return true;
        if (s.notes?.toLowerCase().includes(q)) return true;
        return s.exercises.some(
          (ex) =>
            ex.name.toLowerCase().includes(q) ||
            ex.sets.some((set) => set.note?.toLowerCase().includes(q))
        );
      });
  }, [sessions, activeCategoryFilter, searchQuery]);

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, WorkoutSession[]>();
    for (const s of matchingCompletedSessions) {
      const list = map.get(s.date) ?? [];
      list.push(s);
      map.set(s.date, list);
    }
    for (const [key, list] of map.entries()) {
      list.sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
      map.set(key, list);
    }
    return map;
  }, [matchingCompletedSessions]);

  const calendarCells = useMemo(
    () => buildMonthGridCells(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;

  const monthStats = useMemo(() => {
    let workouts = 0;
    let minutes = 0;
    let volumeKg = 0;
    const activeDates = new Set<string>();

    for (const s of matchingCompletedSessions) {
      if (!s.date.startsWith(monthPrefix)) continue;
      workouts += 1;
      minutes += s.durationMinutes;
      volumeKg += getSessionVolumeKg(s);
      activeDates.add(s.date);
    }

    return {
      workouts,
      activeDays: activeDates.size,
      minutes,
      volumeKg,
    };
  }, [matchingCompletedSessions, monthPrefix]);

  const isViewingCurrentMonth =
    viewYear === initialDate.getFullYear() && viewMonth === initialDate.getMonth();

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleGoToday = () => {
    setViewYear(initialDate.getFullYear());
    setViewMonth(initialDate.getMonth());
  };

  const handleCellClick = (cell: CalendarCell) => {
    const dt = parseLocalDate(cell.date);
    if (!cell.inCurrentMonth) {
      setViewYear(dt.getFullYear());
      setViewMonth(dt.getMonth());
    }
    setConfirmDeleteId(null);
    setSelectedModalDate(cell.date);
  };

  const modalSessions = useMemo(() => {
    if (!selectedModalDate) return [];
    return sessionsByDate.get(selectedModalDate) ?? [];
  }, [selectedModalDate, sessionsByDate]);

  const modalScheduledDay = useMemo(() => {
    if (!selectedModalDate || !activeProgram) return null;
    return getScheduledProgramDay(activeProgram, selectedModalDate, templates);
  }, [selectedModalDate, activeProgram, templates]);

  const modalTotals = useMemo(() => {
    let minutes = 0;
    let volume = 0;
    let distance = 0;
    for (const s of modalSessions) {
      minutes += s.durationMinutes;
      volume += getSessionVolumeKg(s);
      distance += getSessionDistanceKm(s);
    }
    return {
      minutes,
      volume,
      distance: Math.round(distance * 10) / 10,
    };
  }, [modalSessions]);

  const modalYearLabel = selectedModalDate
    ? parseLocalDate(selectedModalDate).getFullYear()
    : '';

  return (
    <section
      aria-label="Календар тренувань"
      className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-4 sm:p-6 space-y-5"
    >
      {/* Header: Month Navigator + Monthly Totals */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="Попередній місяць"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-primary)] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="min-w-[170px] px-2 text-center">
              <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                {UK_MONTHS_NOMINATIVE[viewMonth]} {viewYear}
              </h3>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="Наступний місяць"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-primary)] transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {!isViewingCurrentMonth && (
            <button
              type="button"
              onClick={handleGoToday}
              className="min-h-[40px] px-3.5 text-xs font-semibold rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] hover:bg-[var(--bg-surface-muted)] text-orange-600 dark:text-orange-400 transition-colors"
            >
              Поточний місяць
            </button>
          )}
        </div>

        {/* Month Metrics Summary */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm tabular-nums">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[var(--text-muted)]">Тренувань:</span>
            <span className="font-mono font-semibold text-[var(--text-primary)]">
              {monthStats.workouts}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[var(--text-muted)]">Активних днів:</span>
            <span className="font-mono font-semibold text-[var(--text-primary)]">
              {monthStats.activeDays}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[var(--text-muted)]">Час:</span>
            <span className="font-mono font-semibold text-[var(--text-primary)]">
              {formatNumberUk(monthStats.minutes)} хв
            </span>
          </div>
          {monthStats.volumeKg > 0 && (
            <div className="flex items-baseline gap-1.5">
              <span className="text-[var(--text-muted)]">Тоннаж:</span>
              <span className="font-mono font-semibold text-[var(--text-primary)]">
                {formatNumberUk(monthStats.volumeKg)} кг
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Category Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {(Object.keys(CATEGORY_LABELS) as WorkoutCategory[]).map((cat) => (
            <span key={cat} className="inline-flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-sm ${CATEGORY_BAR_COLORS[cat]}`} />
              <span>{CATEGORY_LABELS[cat]}</span>
            </span>
          ))}
          {activeProgram && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm border border-dashed border-orange-500" />
              <span>За програмою</span>
            </span>
          )}
        </div>
        <span>Натисніть на дату для перегляду або додавання тренування</span>
      </div>

      {/* Month Calendar Grid */}
      <div className="space-y-1.5">
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {WEEKDAY_HEADERS.map((wd) => (
            <div
              key={wd}
              className="py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]"
            >
              {wd}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {calendarCells.map((cell) => {
            const daySessions = sessionsByDate.get(cell.date) ?? [];
            const isToday = cell.date === todayDate;
            const isSelected = cell.date === selectedModalDate;
            const scheduledDay =
              daySessions.length === 0 && activeProgram && cell.inCurrentMonth
                ? getScheduledProgramDay(activeProgram, cell.date, templates)
                : null;
            const hasScheduledTemplate = Boolean(scheduledDay?.template);

            return (
              <button
                key={cell.date}
                type="button"
                onClick={() => handleCellClick(cell)}
                aria-label={`${formatUkDateLong(cell.date)}${
                  daySessions.length > 0
                    ? `, ${daySessions.length} тренувань`
                    : hasScheduledTemplate
                      ? `, заплановано ${scheduledDay?.template?.title}`
                      : ''
                }`}
                className={`group relative min-h-[64px] sm:min-h-[96px] p-1.5 sm:p-2 rounded-xl border text-left flex flex-col justify-between transition-colors ${
                  isSelected
                    ? 'border-orange-600 bg-orange-50/70 dark:bg-orange-950/30 ring-1 ring-orange-600'
                    : isToday
                      ? 'border-orange-500/80 bg-[var(--bg-surface-subtle)] hover:bg-[var(--bg-surface-muted)]'
                      : daySessions.length > 0
                        ? 'border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-muted)]'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-subtle)]'
                } ${!cell.inCurrentMonth ? 'opacity-45' : ''}`}
              >
                {/* Top row: Day number + count badge */}
                <div className="w-full flex items-center justify-between gap-1">
                  <span
                    className={`font-mono text-xs sm:text-sm font-semibold tabular-nums leading-none ${
                      isToday
                        ? 'text-orange-600 dark:text-orange-400'
                        : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {cell.dayNumber}
                  </span>

                  {daySessions.length > 0 && (
                    <span className="font-mono text-[10px] font-semibold tabular-nums text-[var(--text-muted)]">
                      {daySessions.length > 1 ? `×${daySessions.length}` : ''}
                    </span>
                  )}
                </div>

                {/* Desktop/tablet workout entries */}
                <div className="hidden sm:flex flex-col gap-1 w-full mt-1.5">
                  {daySessions.slice(0, 2).map((s) => (
                    <div
                      key={s.id}
                      className={`px-1.5 py-0.5 rounded-md border text-[11px] font-medium truncate ${CATEGORY_SOFT_BG[s.category]}`}
                    >
                      {s.title}
                    </div>
                  ))}
                  {daySessions.length > 2 && (
                    <span className="text-[10px] font-mono font-semibold text-[var(--text-muted)] pl-1">
                      +{daySessions.length - 2} ще
                    </span>
                  )}
                  {daySessions.length === 0 && scheduledDay?.template && (
                    <div className="px-1.5 py-0.5 rounded-md border border-dashed border-orange-400/60 dark:border-orange-500/50 text-[10px] font-medium text-[var(--text-secondary)] truncate">
                      {scheduledDay.template.title}
                    </div>
                  )}
                </div>

                {/* Mobile compact dots */}
                <div className="flex sm:hidden items-center gap-1 mt-1 flex-wrap">
                  {daySessions.slice(0, 3).map((s) => (
                    <span
                      key={s.id}
                      className={`w-2 h-2 rounded-full ${CATEGORY_BAR_COLORS[s.category]}`}
                    />
                  ))}
                  {daySessions.length === 0 && hasScheduledTemplate && (
                    <span className="w-2 h-2 rounded-full border border-dashed border-orange-500" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Workouts Modal */}
      {selectedModalDate && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="calendar-day-modal-title"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => {
            setSelectedModalDate(null);
            setConfirmDeleteId(null);
          }}
        >
          <div
            className="w-full max-w-2xl max-h-[88vh] flex flex-col bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  <h3
                    id="calendar-day-modal-title"
                    className="text-lg font-semibold text-[var(--text-primary)]"
                  >
                    {formatUkDateLong(selectedModalDate)} {modalYearLabel}
                  </h3>
                  {selectedModalDate === todayDate && (
                    <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                      · Сьогодні
                    </span>
                  )}
                </div>

                {modalSessions.length > 0 ? (
                  <p className="mt-1 text-xs font-mono tabular-nums text-[var(--text-muted)]">
                    Тренувань: {modalSessions.length} · {modalTotals.minutes} хв
                    {modalTotals.volume > 0
                      ? ` · ${formatNumberUk(modalTotals.volume)} кг`
                      : ''}
                    {modalTotals.distance > 0 ? ` · ${modalTotals.distance} км` : ''}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Записів тренувань на цю дату немає
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedModalDate(null);
                  setConfirmDeleteId(null);
                }}
                aria-label="Закрити вікно дня"
                className="min-h-[40px] min-w-[40px] rounded-xl hover:bg-[var(--bg-surface-muted)] text-[var(--text-muted)] flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {modalSessions.length === 0 ? (
                <div className="p-6 rounded-2xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-center space-y-2">
                  <Dumbbell className="w-6 h-6 text-[var(--text-muted)] mx-auto" />
                  <div className="text-sm font-semibold text-[var(--text-primary)]">
                    Тренувань за {formatUkDateShort(selectedModalDate)} не знайдено
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    Ви можете додати тренування на цю дату вручну або змінити активні фільтри.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {modalSessions.map((session) => {
                    const vol = getSessionVolumeKg(session);
                    const dist = getSessionDistanceKm(session);
                    return (
                      <article
                        key={session.id}
                        className="p-4 rounded-2xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-muted)]">
                              <span
                                className={`font-semibold ${CATEGORY_ACCENTS[session.category]}`}
                              >
                                {CATEGORY_LABELS[session.category]}
                              </span>
                              {session.startTime && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono tabular-nums">
                                    {session.startTime}
                                  </span>
                                </>
                              )}
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">
                                {session.durationMinutes} хв
                              </span>
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
                              <span className="font-mono tabular-nums">
                                RPE {session.rpe}/10
                              </span>
                            </div>

                            <h4 className="mt-1 text-base font-semibold text-[var(--text-primary)]">
                              {session.title}
                            </h4>
                            {session.notes && (
                              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                                {session.notes}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                onDuplicateWorkout(session);
                                setSelectedModalDate(null);
                              }}
                              title="Скопіювати на сьогодні"
                              aria-label={`Скопіювати ${session.title} на сьогодні`}
                              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] transition-colors"
                            >
                              <Copy className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedModalDate(null);
                                onEditWorkout(session);
                              }}
                              title="Редагувати"
                              aria-label={`Редагувати ${session.title}`}
                              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] transition-colors"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            {confirmDeleteId !== session.id ? (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(session.id)}
                                title="Видалити"
                                aria-label={`Видалити ${session.title}`}
                                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
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
                                  className="min-h-[40px] px-3 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white whitespace-nowrap"
                                >
                                  Видалити
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="min-h-[40px] px-2.5 text-xs font-medium rounded-xl bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] whitespace-nowrap"
                                >
                                  Ні
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {session.exercises.length > 0 && (
                          <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2">
                            {session.exercises.map((ex) => (
                              <div
                                key={ex.id}
                                className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1.5 text-xs"
                              >
                                <span className="font-semibold text-[var(--text-primary)]">
                                  {ex.name}
                                </span>
                                <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono tabular-nums text-[var(--text-secondary)]">
                                  {ex.sets.map((s, idx) => (
                                    <span key={s.id}>
                                      {ex.trackingType === 'strength'
                                        ? `${idx + 1}: ${s.weightKg} кг × ${s.reps}`
                                        : ex.trackingType === 'cardio'
                                          ? `${s.distanceKm ?? 0} км · ${Math.round(
                                              (s.durationSec ?? 0) / 60
                                            )} хв`
                                          : `${Math.round((s.durationSec ?? 0) / 60)} хв`}
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

              {/* Scheduled Program Workout for this Day */}
              {modalScheduledDay?.template && (
                <div className="p-4 rounded-2xl border border-dashed border-orange-400/70 dark:border-orange-500/50 bg-orange-50/50 dark:bg-orange-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-orange-700 dark:text-orange-400">
                      <CalendarPlus className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        За програмою «{modalScheduledDay.program.title}» · Тиждень{' '}
                        {modalScheduledDay.weekNumber}
                      </span>
                    </div>
                    <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                      {modalScheduledDay.template.title}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {CATEGORY_LABELS[modalScheduledDay.template.category]} · ~
                      {modalScheduledDay.template.estimatedMinutes} хв ·{' '}
                      {modalScheduledDay.template.exercises.length} вправ
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={hasActiveLive}
                    onClick={() => {
                      onStartTemplateLive(modalScheduledDay.template!);
                      setSelectedModalDate(null);
                    }}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-orange-600 hover:bg-slate-800 dark:hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                    {hasActiveLive ? 'Сесія триває' : 'Запустити на сьогодні'}
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  const targetDate = selectedModalDate;
                  setSelectedModalDate(null);
                  setConfirmDeleteId(null);
                  onOpenNewWorkoutForDate(targetDate);
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Додати тренування на {formatUkDateShort(selectedModalDate)}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedModalDate(null);
                  setConfirmDeleteId(null);
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-muted)] text-sm font-semibold text-[var(--text-secondary)] transition-colors"
              >
                Закрити
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
