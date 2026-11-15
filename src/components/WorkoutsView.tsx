import React, { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Calendar,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  ChevronDown,
  ChevronUp,
  Copy,
  Edit3,
  LayoutList,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Wand2,
} from 'lucide-react';
import {
  TrainingProgram,
  WorkoutCategory,
  WorkoutSession,
  WorkoutTemplate,
} from '../types/workout';
import {
  CATEGORY_ACCENTS,
  CATEGORY_LABELS,
  PROGRAM_WEEKDAYS,
  addDays,
  formatNumberUk,
  formatUkDateLong,
  formatUkDateShort,
  getSessionDistanceKm,
  getSessionVolumeKg,
} from '../utils/workoutStats';
import { CalendarSyncModal } from './CalendarSyncModal';
import { ProgramBuilderModal } from './ProgramBuilderModal';
import { WorkoutCalendarSection } from './WorkoutCalendarSection';

type DateRangePreset = 'all' | '7d' | '30d' | 'month' | 'custom';
type JournalViewMode = 'both' | 'calendar' | 'list';
type WorkoutSortOption =
  | 'date-desc'
  | 'date-asc'
  | 'duration-desc'
  | 'volume-desc'
  | 'category';

interface WorkoutsViewProps {
  sessions: WorkoutSession[];
  templates: WorkoutTemplate[];
  programs: TrainingProgram[];
  todayDate: string;
  hasActiveLive: boolean;
  onOpenNewWorkout: () => void;
  onOpenNewWorkoutForDate?: (date: string) => void;
  onEditWorkout: (session: WorkoutSession) => void;
  onDeleteWorkout: (id: string) => void;
  onDuplicateWorkout: (session: WorkoutSession) => void;
  onStartTemplateLive: (template: WorkoutTemplate) => void;
  onSaveProgram: (program: TrainingProgram) => void;
  onToggleActivateProgram: (id: string) => void;
  onDeleteProgram: (id: string) => void;
  onOpenAiPlanModal: () => void;
  onNotify?: (message: string) => void;
}

function getWeeksLabel(n: number): string {
  if (n === 1) return 'тиждень';
  if (n >= 2 && n <= 4) return 'тижні';
  return 'тижнів';
}

export const WorkoutsView: React.FC<WorkoutsViewProps> = ({
  sessions,
  templates,
  programs,
  todayDate,
  hasActiveLive,
  onOpenNewWorkout,
  onOpenNewWorkoutForDate,
  onEditWorkout,
  onDeleteWorkout,
  onDuplicateWorkout,
  onStartTemplateLive,
  onSaveProgram,
  onToggleActivateProgram,
  onDeleteProgram,
  onOpenAiPlanModal,
  onNotify,
}) => {
  const [viewMode, setViewMode] = useState<JournalViewMode>('both');
  const [filterCat, setFilterCat] = useState<'all' | WorkoutCategory>('all');
  const [datePreset, setDatePreset] = useState<DateRangePreset>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<WorkoutSortOption>('date-desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [programModalOpen, setProgramModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<TrainingProgram | null>(null);
  const [calendarSyncProgram, setCalendarSyncProgram] =
    useState<TrainingProgram | null>(null);
  const [expandedProgramIds, setExpandedProgramIds] = useState<Record<string, boolean>>({});
  const [confirmDeleteProgramId, setConfirmDeleteProgramId] = useState<string | null>(null);

  const applyDatePreset = (preset: Exclude<DateRangePreset, 'custom'>) => {
    setDatePreset(preset);
    if (preset === 'all') {
      setDateFrom('');
      setDateTo('');
    } else if (preset === '7d') {
      setDateFrom(addDays(todayDate, -6));
      setDateTo(todayDate);
    } else if (preset === '30d') {
      setDateFrom(addDays(todayDate, -29));
      setDateTo(todayDate);
    } else if (preset === 'month') {
      setDateFrom(`${todayDate.slice(0, 7)}-01`);
      setDateTo(todayDate);
    }
  };

  const handleDateFromChange = (val: string) => {
    setDateFrom(val);
    setDatePreset(val || dateTo ? 'custom' : 'all');
  };

  const handleDateToChange = (val: string) => {
    setDateTo(val);
    setDatePreset(dateFrom || val ? 'custom' : 'all');
  };

  const resetAllFilters = () => {
    setFilterCat('all');
    setDatePreset('all');
    setDateFrom('');
    setDateTo('');
    setSortBy('date-desc');
    setSearchQuery('');
  };

  const hasActiveFilters =
    filterCat !== 'all' ||
    datePreset !== 'all' ||
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    sortBy !== 'date-desc' ||
    searchQuery.trim().length > 0;

  const dateAndSearchSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const hasBounds = Boolean(dateFrom) && Boolean(dateTo);
    const minDate = hasBounds && dateFrom > dateTo ? dateTo : dateFrom;
    const maxDate = hasBounds && dateFrom > dateTo ? dateFrom : dateTo;

    return sessions
      .filter((s) => s.completed)
      .filter((s) => {
        if (minDate && s.date < minDate) return false;
        if (maxDate && s.date > maxDate) return false;
        return true;
      })
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
  }, [sessions, dateFrom, dateTo, searchQuery]);

  const categoryCounts = useMemo(() => {
    const counts: Record<WorkoutCategory, number> = {
      strength: 0,
      cardio: 0,
      hiit: 0,
      mobility: 0,
    };
    for (const s of dateAndSearchSessions) {
      counts[s.category] += 1;
    }
    return counts;
  }, [dateAndSearchSessions]);

  const filteredSessions = useMemo(() => {
    const byCategory = dateAndSearchSessions.filter((s) =>
      filterCat === 'all' ? true : s.category === filterCat
    );

    return [...byCategory].sort((a, b) => {
      if (sortBy === 'date-asc') {
        return (
          a.date.localeCompare(b.date) ||
          (a.startTime ?? '').localeCompare(b.startTime ?? '')
        );
      }
      if (sortBy === 'duration-desc') {
        return (
          b.durationMinutes - a.durationMinutes ||
          b.date.localeCompare(a.date)
        );
      }
      if (sortBy === 'volume-desc') {
        return (
          getSessionVolumeKg(b) - getSessionVolumeKg(a) ||
          b.date.localeCompare(a.date)
        );
      }
      if (sortBy === 'category') {
        return (
          CATEGORY_LABELS[a.category].localeCompare(
            CATEGORY_LABELS[b.category],
            'uk'
          ) || b.date.localeCompare(a.date)
        );
      }
      return (
        b.date.localeCompare(a.date) ||
        (b.startTime ?? '').localeCompare(a.startTime ?? '')
      );
    });
  }, [dateAndSearchSessions, filterCat, sortBy]);

  const filteredTotals = useMemo(() => {
    let minutes = 0;
    let volume = 0;
    for (const s of filteredSessions) {
      minutes += s.durationMinutes;
      volume += getSessionVolumeKg(s);
    }
    return { minutes, volume };
  }, [filteredSessions]);

  const sortedPrograms = useMemo(
    () => [...programs].sort((a, b) => Number(b.isActive) - Number(a.isActive)),
    [programs]
  );

  const templatesById = useMemo(
    () => new Map(templates.map((t) => [t.id, t])),
    [templates]
  );

  const activeProgram = useMemo(
    () => programs.find((p) => p.isActive),
    [programs]
  );

  return (
    <div className="space-y-8">
      {/* View Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Формат відображення журналу"
          className="inline-flex items-center gap-1 p-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl"
        >
          {(
            [
              { id: 'both', label: 'Календар і список', icon: CalendarRange },
              { id: 'calendar', label: 'Календар', icon: CalendarDays },
              { id: 'list', label: 'Список', icon: LayoutList },
            ] as const
          ).map((mode) => {
            const Icon = mode.icon;
            const active = viewMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setViewMode(mode.id)}
                className={`min-h-[40px] px-3.5 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap ${
                  active
                    ? 'bg-slate-900 dark:bg-orange-600 text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Filter & Sort Panel */}
      <section
        aria-label="Панель швидких фільтрів журналу"
        className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-4 sm:p-5 space-y-4"
      >
        {/* Row 1: Category Filter Bar + Search + Primary CTA */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-[var(--bg-surface-muted)] rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setFilterCat('all')}
              className={`min-h-[40px] px-3.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                filterCat === 'all'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Усі ({dateAndSearchSessions.length})
            </button>
            {(Object.keys(CATEGORY_LABELS) as WorkoutCategory[]).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilterCat(cat)}
                className={`min-h-[40px] px-3.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                  filterCat === cat
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {CATEGORY_LABELS[cat]} ({categoryCounts[cat]})
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Пошук за назвою чи вправою..."
                aria-label="Пошук тренувань"
                className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-orange-600"
              />
            </div>

            <button
              type="button"
              onClick={onOpenNewWorkout}
              className="min-h-[44px] px-4 py-2 text-sm font-semibold rounded-xl bg-orange-600 hover:bg-orange-700 text-white transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              Нове тренування
            </button>
          </div>
        </div>

        {/* Row 2: Date Range Presets, Custom Date Inputs & Sorting */}
        <div className="pt-3.5 border-t border-[var(--border-subtle)] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] whitespace-nowrap">
              <Calendar className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400 shrink-0" />
              <span>Період:</span>
            </span>

            <div className="flex flex-wrap items-center gap-1 p-1 bg-[var(--bg-surface-muted)] rounded-xl">
              {(
                [
                  { id: 'all', label: 'Увесь час' },
                  { id: '7d', label: '7 днів' },
                  { id: '30d', label: '30 днів' },
                  { id: 'month', label: 'Цей місяць' },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyDatePreset(preset.id)}
                  className={`min-h-[36px] px-3 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    datePreset === preset.id
                      ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                <span>Від</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => handleDateFromChange(e.target.value)}
                  aria-label="Дата початку діапазону"
                  className="min-h-[40px] px-2.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] font-mono text-xs text-[var(--text-primary)] focus:outline-none focus:border-orange-600"
                />
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                <span>До</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => handleDateToChange(e.target.value)}
                  aria-label="Дата завершення діапазону"
                  className="min-h-[40px] px-2.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] font-mono text-xs text-[var(--text-primary)] focus:outline-none focus:border-orange-600"
                />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 shrink-0">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
              <ArrowUpDown className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
              <span className="whitespace-nowrap">Сортування:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as WorkoutSortOption)}
                aria-label="Сортування історії тренувань"
                className="min-h-[40px] px-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-xs font-semibold text-[var(--text-primary)] focus:outline-none focus:border-orange-600"
              >
                <option value="date-desc">Спочатку новіші</option>
                <option value="date-asc">Спочатку старіші</option>
                <option value="duration-desc">За тривалістю</option>
                <option value="volume-desc">За об&apos;ємом (кг)</option>
                <option value="category">За категорією</option>
              </select>
            </label>
          </div>
        </div>

        {/* Row 3: Summary & Quick Reset */}
        <div className="pt-3 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 tabular-nums">
            <span>
              Показано:{' '}
              <strong className="font-mono font-semibold text-[var(--text-primary)]">
                {filteredSessions.length}
              </strong>
            </span>
            {filteredTotals.minutes > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{formatNumberUk(filteredTotals.minutes)} хв</span>
              </>
            )}
            {filteredTotals.volume > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{formatNumberUk(filteredTotals.volume)} кг</span>
              </>
            )}
            {dateFrom && dateTo && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  {formatUkDateShort(dateFrom <= dateTo ? dateFrom : dateTo)} –{' '}
                  {formatUkDateShort(dateFrom <= dateTo ? dateTo : dateFrom)}
                </span>
              </>
            )}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="min-h-[34px] px-2.5 text-xs font-semibold rounded-lg text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Скинути фільтри
            </button>
          )}
        </div>
      </section>

      {/* Full Monthly Calendar */}
      {viewMode !== 'list' && (
        <WorkoutCalendarSection
          sessions={sessions}
          activeProgram={activeProgram}
          templates={templates}
          todayDate={todayDate}
          hasActiveLive={hasActiveLive}
          activeCategoryFilter={filterCat}
          searchQuery={searchQuery}
          onOpenNewWorkoutForDate={(date) =>
            onOpenNewWorkoutForDate ? onOpenNewWorkoutForDate(date) : onOpenNewWorkout()
          }
          onEditWorkout={onEditWorkout}
          onDeleteWorkout={onDeleteWorkout}
          onDuplicateWorkout={onDuplicateWorkout}
          onStartTemplateLive={onStartTemplateLive}
        />
      )}

      {/* Workout History List */}
      {viewMode !== 'calendar' && (
      <section aria-label="Історія тренувань">
        {filteredSessions.length === 0 ? (
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-10 text-center">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              Тренувань за цими фільтрами не знайдено
            </h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Змініть категорію, діапазон дат або пошуковий запит.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="mt-4 min-h-[40px] px-4 py-2 text-xs font-semibold rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface-subtle)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-primary)] transition-colors inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Скинути фільтри
              </button>
            )}
          </div>
        ) : (
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)]">
            {filteredSessions.map((session) => {
              const isExpanded = Boolean(expandedIds[session.id]);
              const vol = getSessionVolumeKg(session);
              const dist = getSessionDistanceKm(session);

              return (
                <article key={session.id} className="p-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-muted)]">
                        <span className="font-medium text-[var(--text-secondary)]">
                          {formatUkDateLong(session.date)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className={`font-semibold ${CATEGORY_ACCENTS[session.category]}`}>
                          {CATEGORY_LABELS[session.category]}
                        </span>
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

                      <h3 className="mt-1 text-lg font-semibold text-[var(--text-primary)] truncate">
                        {session.title}
                      </h3>
                      {session.notes && (
                        <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{session.notes}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {session.exercises.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedIds((p) => ({
                              ...p,
                              [session.id]: !p[session.id],
                            }))
                          }
                          className="min-h-[44px] px-3 text-xs font-semibold rounded-xl border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] transition-colors flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <span>{session.exercises.length} вправ</span>
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
                        title="Скопіювати на сьогодні"
                        aria-label={`Скопіювати ${session.title} на сьогодні`}
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
                            className="min-h-[44px] px-3 text-xs font-semibold rounded-xl bg-rose-600 text-white hover:bg-rose-700 whitespace-nowrap"
                          >
                            Видалити
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="min-h-[44px] px-2.5 text-xs font-medium rounded-xl bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] whitespace-nowrap"
                          >
                            Ні
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {isExpanded && session.exercises.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] space-y-2">
                      {session.exercises.map((ex) => (
                        <div
                          key={ex.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm"
                        >
                          <span className="font-medium text-[var(--text-primary)]">{ex.name}</span>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-mono tabular-nums text-[var(--text-secondary)]">
                            {ex.sets.map((s, idx) => (
                              <span key={s.id}>
                                {ex.trackingType === 'strength'
                                  ? `${idx + 1}: ${s.weightKg} кг × ${s.reps}`
                                  : ex.trackingType === 'cardio'
                                    ? `${s.distanceKm ?? 0} км · ${Math.round((s.durationSec ?? 0) / 60)} хв`
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
      </section>
      )}

      {/* Multi-Week Training Programs */}
      <section aria-label="Багатотижневі програми тренувань">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
              Багатотижневі програми
            </h3>
            <p className="text-sm text-[var(--text-muted)]">
              Групуйте шаблони тренувань у послідовний тижневий графік із автоматичним підказуванням на вкладці «Сьогодні».
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenAiPlanModal}
              className="min-h-[44px] px-4 py-2 text-sm font-semibold rounded-xl border border-orange-200 dark:border-orange-800/70 bg-orange-50 dark:bg-orange-950/40 hover:bg-orange-100 dark:hover:bg-orange-950/70 text-orange-800 dark:text-orange-300 transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <Wand2 className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              Згенерувати план (ШІ)
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingProgram(null);
                setProgramModalOpen(true);
              }}
              className="min-h-[44px] px-4 py-2 text-sm font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Створити програму
            </button>
          </div>
        </div>

        {sortedPrograms.length === 0 ? (
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-8 text-center">
            <h4 className="text-base font-semibold text-[var(--text-primary)]">
              Немає створених програм
            </h4>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Створіть послідовний план на 1–12 тижнів, розподіливши шаблони за днями тижня.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedPrograms.map((program) => {
              const isExpanded =
                expandedProgramIds[program.id] ?? program.isActive;
              const plannedWorkoutsCount = program.weeks.reduce(
                (acc, week) =>
                  acc +
                  PROGRAM_WEEKDAYS.filter((wd) => Boolean(week.days[wd.index])).length,
                0
              );

              return (
                <article
                  key={program.id}
                  className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden"
                >
                  <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-muted)]">
                        <span
                          className={`font-semibold ${
                            program.isActive ? 'text-orange-700 dark:text-orange-400' : 'text-[var(--text-muted)]'
                          }`}
                        >
                          {program.isActive ? 'Активна програма' : 'Неактивна'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {program.durationWeeks} {getWeeksLabel(program.durationWeeks)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {plannedWorkoutsCount} тренувань
                        </span>
                        {program.startDate && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>
                              Початок {formatUkDateShort(program.startDate)}
                            </span>
                          </>
                        )}
                      </div>

                      <h4 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
                        {program.title}
                      </h4>
                      <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
                        {program.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onToggleActivateProgram(program.id)}
                        className={`min-h-[40px] px-3.5 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                          program.isActive
                            ? 'border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-secondary)]'
                            : 'bg-orange-600 hover:bg-orange-700 text-white'
                        }`}
                      >
                        {program.isActive ? (
                          <>
                            <Pause className="w-3.5 h-3.5" />
                            Призупинити
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5" />
                            Активувати
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedProgramIds((prev) => ({
                            ...prev,
                            [program.id]: !isExpanded,
                          }))
                        }
                        className="min-h-[40px] px-3 text-xs font-semibold rounded-xl border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] transition-colors flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <CalendarRange className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                        <span>Розклад</span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setCalendarSyncProgram(program)}
                        title="Експортувати у календар (.ics або посилання)"
                        aria-label={`Експортувати програму ${program.title} у календар`}
                        className="min-h-[40px] px-3 text-xs font-semibold rounded-xl border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] transition-colors flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <CalendarPlus className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                        <span>Календар</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingProgram(program);
                          setProgramModalOpen(true);
                        }}
                        title="Редагувати програму"
                        aria-label={`Редагувати програму ${program.title}`}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      {confirmDeleteProgramId !== program.id ? (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteProgramId(program.id)}
                          title="Видалити програму"
                          aria-label={`Видалити програму ${program.title}`}
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteProgram(program.id);
                              setConfirmDeleteProgramId(null);
                            }}
                            className="min-h-[40px] px-3 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white whitespace-nowrap"
                          >
                            Видалити
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteProgramId(null)}
                            className="min-h-[40px] px-2.5 text-xs font-medium rounded-xl bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] whitespace-nowrap"
                          >
                            Ні
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
                      {program.weeks.map((week) => (
                        <div key={week.weekNumber} className="px-5 py-4 space-y-2.5">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                              Тиждень {week.weekNumber}
                            </span>
                            {week.focusNote && (
                              <span className="text-xs text-[var(--text-muted)]">
                                {week.focusNote}
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                            {PROGRAM_WEEKDAYS.map((wd) => {
                              const tplId = week.days[wd.index];
                              const tpl = tplId ? templatesById.get(tplId) : undefined;

                              return (
                                <div
                                  key={wd.index}
                                  className={`rounded-xl px-3 py-2.5 flex flex-col justify-between gap-1.5 ${
                                    tpl
                                      ? 'bg-[var(--bg-surface)] border border-[var(--border-subtle)]'
                                      : 'bg-[var(--bg-surface-muted)]'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-[11px] font-mono font-semibold text-[var(--text-muted)]">
                                      {wd.short}
                                    </span>
                                    {tpl && (
                                      <span
                                        className={`text-[10px] font-semibold ${CATEGORY_ACCENTS[tpl.category]}`}
                                      >
                                        {CATEGORY_LABELS[tpl.category]}
                                      </span>
                                    )}
                                  </div>

                                  {tpl ? (
                                    <button
                                      type="button"
                                      disabled={hasActiveLive}
                                      onClick={() => onStartTemplateLive(tpl)}
                                      title={
                                        hasActiveLive
                                          ? 'Сесія вже триває'
                                          : `Запустити: ${tpl.title}`
                                      }
                                      className="text-left text-xs font-semibold text-[var(--text-primary)] hover:text-orange-600 dark:hover:text-orange-400 disabled:hover:text-[var(--text-primary)] disabled:opacity-60 transition-colors line-clamp-2"
                                    >
                                      {tpl.title}
                                    </button>
                                  ) : (
                                    <span className="text-xs text-[var(--text-muted)]">
                                      Відпочинок
                                    </span>
                                  )}
                                </div>
                              );
                            })}
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

      {/* All Templates */}
      <section aria-label="Усі шаблони тренувань">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
          Шаблони для швидкого запуску
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => (
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
                </div>
                <h4 className="mt-1.5 text-base font-semibold text-[var(--text-primary)]">
                  {tpl.title}
                </h4>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{tpl.description}</p>
              </div>
              <button
                type="button"
                disabled={hasActiveLive}
                onClick={() => onStartTemplateLive(tpl)}
                className="min-h-[44px] w-full px-4 py-2 text-sm font-semibold rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] hover:bg-slate-900 dark:hover:bg-orange-600 hover:text-white hover:border-slate-900 dark:hover:border-orange-500 disabled:opacity-50 text-[var(--text-primary)] transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <Play className="w-4 h-4" />
                {hasActiveLive ? 'Сесія триває' : 'Запустити сесію'}
              </button>
            </div>
          ))}
        </div>
      </section>

      {programModalOpen && (
        <ProgramBuilderModal
          initialProgram={editingProgram}
          templates={templates}
          todayDate={todayDate}
          onSave={(prog) => {
            onSaveProgram(prog);
            setProgramModalOpen(false);
          }}
          onClose={() => setProgramModalOpen(false)}
        />
      )}

      {calendarSyncProgram && (
        <CalendarSyncModal
          program={calendarSyncProgram}
          templates={templates}
          todayDate={todayDate}
          onNotify={onNotify}
          onClose={() => setCalendarSyncProgram(null)}
        />
      )}
    </div>
  );
};

