import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  HeartPulse,
  Layers,
  RefreshCw,
  Scale,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  AiAdviceFocus,
  AiProgressAdvice,
  WeeklyGoals,
  WorkoutCategory,
  WorkoutSession,
} from '../types/workout';
import { ExerciseWeightD3Chart } from './ExerciseWeightD3Chart';
import { MuscleBodyMap } from './MuscleBodyMap';
import { YearlyHeatmapChart } from './YearlyHeatmapChart';
import {
  CATEGORY_BAR_COLORS,
  CATEGORY_LABELS,
  addDays,
  extractPersonalRecords,
  formatNumberUk,
  formatUkDateShort,
  getSessionDistanceKm,
  getSessionVolumeKg,
  getWeekDays,
  getWeekStartMonday,
} from '../utils/workoutStats';

const ADVICE_FOCUS_META: Record<
  AiAdviceFocus,
  {
    label: string;
    accentClass: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  intensity: {
    label: 'Інтенсивність',
    accentClass: 'text-orange-700 dark:text-orange-400',
    icon: TrendingUp,
  },
  volume: {
    label: 'Обсяг',
    accentClass: 'text-sky-700 dark:text-sky-400',
    icon: Layers,
  },
  recovery: {
    label: 'Відновлення',
    accentClass: 'text-emerald-700 dark:text-emerald-400',
    icon: HeartPulse,
  },
  balance: {
    label: 'Баланс',
    accentClass: 'text-violet-700 dark:text-violet-400',
    icon: Scale,
  },
};

interface ProgressViewProps {
  todayDate: string;
  sessions: WorkoutSession[];
  goals: WeeklyGoals;
}

export const ProgressView: React.FC<ProgressViewProps> = ({
  todayDate,
  sessions,
  goals,
}) => {
  const [chartMetric, setChartMetric] = useState<'minutes' | 'volume'>('minutes');
  const [aiAdvice, setAiAdvice] = useState<AiProgressAdvice | null>(null);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [adviceError, setAdviceError] = useState<string | null>(null);

  const weekStart = getWeekStartMonday(todayDate);
  const weekDays = getWeekDays(weekStart);
  const weekEnd = addDays(weekStart, 6);

  const completedSessions = useMemo(
    () => sessions.filter((s) => s.completed),
    [sessions]
  );

  const weeklyChartData = useMemo(() => {
    return weekDays.map((d) => {
      const dayList = completedSessions.filter((s) => s.date === d.date);
      const minutes = dayList.reduce((acc, s) => acc + s.durationMinutes, 0);
      const volume = dayList.reduce((acc, s) => acc + getSessionVolumeKg(s), 0);
      return {
        ...d,
        minutes,
        volume,
        count: dayList.length,
      };
    });
  }, [weekDays, completedSessions]);

  const maxChartValue = useMemo(() => {
    const rawMax = Math.max(
      1,
      ...weeklyChartData.map((d) => (chartMetric === 'minutes' ? d.minutes : d.volume))
    );
    return chartMetric === 'minutes'
      ? Math.max(goals.dailyMinutesTarget, rawMax)
      : rawMax;
  }, [weeklyChartData, chartMetric, goals.dailyMinutesTarget]);

  const weekMinutesTotal = weeklyChartData.reduce((a, b) => a + b.minutes, 0);
  const weekVolumeTotal = weeklyChartData.reduce((a, b) => a + b.volume, 0);
  const weekWorkoutsCount = weeklyChartData.reduce((a, b) => a + b.count, 0);

  const recent30dStats = useMemo(() => {
    const start30d = addDays(todayDate, -29);
    const in30d = completedSessions.filter(
      (s) => s.date >= start30d && s.date <= todayDate
    );
    const totalMinutes30d = in30d.reduce((a, s) => a + s.durationMinutes, 0);
    const totalVolume30d = in30d.reduce((a, s) => a + getSessionVolumeKg(s), 0);
    const avgRpe =
      in30d.length > 0
        ? Math.round(
            (in30d.reduce((a, s) => a + s.rpe, 0) / in30d.length) * 10
          ) / 10
        : 0;
    return {
      totalWorkouts30d: in30d.length,
      totalMinutes30d,
      totalVolume30d,
      avgRpe,
      workoutsThisWeek: weekWorkoutsCount,
      minutesThisWeek: weekMinutesTotal,
    };
  }, [completedSessions, todayDate, weekWorkoutsCount, weekMinutesTotal]);

  const handleRequestAdvice = async () => {
    if (completedSessions.length === 0) {
      setAdviceError(
        'Додайте хоча б одне завершене тренування, щоб отримати аналітичну пораду.'
      );
      return;
    }

    setAdviceLoading(true);
    setAdviceError(null);

    try {
      const recentSorted = [...completedSessions]
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) ||
            (b.startTime ?? '').localeCompare(a.startTime ?? '')
        )
        .slice(0, 14);

      const recentSessionsPayload = recentSorted.map((s) => {
        const muscleGroups = Array.from(
          new Set(s.exercises.map((ex) => ex.muscleGroup))
        );
        const exercisesSummary = s.exercises.slice(0, 6).map((ex) => {
          if (ex.trackingType === 'strength') {
            const bestSet = ex.sets.reduce(
              (best, curr) =>
                curr.weightKg > best.weightKg ? curr : best,
              ex.sets[0] ?? { weightKg: 0, reps: 0 }
            );
            return `${ex.name} (${ex.sets.length} підх., макс ${bestSet.weightKg} кг×${bestSet.reps})`;
          }
          if (ex.trackingType === 'cardio') {
            const km = ex.sets.reduce((sum, st) => sum + (st.distanceKm ?? 0), 0);
            return `${ex.name} (${Math.round(km * 10) / 10} км)`;
          }
          const mins = Math.round(
            ex.sets.reduce((sum, st) => sum + (st.durationSec ?? 0), 0) / 60
          );
          return `${ex.name} (${mins} хв)`;
        });

        const setNotes = s.exercises
          .flatMap((ex) => ex.sets.map((st) => st.note?.trim()).filter(Boolean))
          .slice(0, 3);
        const combinedNotes = [s.notes?.trim(), ...setNotes]
          .filter(Boolean)
          .join('; ');

        return {
          date: s.date,
          title: s.title,
          category: CATEGORY_LABELS[s.category],
          durationMinutes: s.durationMinutes,
          rpe: s.rpe,
          volumeKg: getSessionVolumeKg(s),
          distanceKm: getSessionDistanceKm(s),
          muscleGroups,
          exercisesSummary,
          notes: combinedNotes || undefined,
        };
      });

      const response = await fetch('/api/ai/progress-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recentSessions: recentSessionsPayload,
          goals: {
            workoutsPerWeek: goals.workoutsPerWeek,
            minutesPerWeek: goals.minutesPerWeek,
            weeklyVolumeKg: goals.weeklyVolumeKg,
          },
          periodStats: recent30dStats,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data?.error || 'Не вдалося отримати аналітичну пораду від ШІ.'
        );
      }

      setAiAdvice(data as AiProgressAdvice);
    } catch (err) {
      setAdviceError(
        err instanceof Error
          ? err.message
          : 'Помилка запиту аналітичної поради.'
      );
    } finally {
      setAdviceLoading(false);
    }
  };

  const categoryBreakdown = useMemo(() => {
    const totals: Record<WorkoutCategory, { count: number; minutes: number }> = {
      strength: { count: 0, minutes: 0 },
      cardio: { count: 0, minutes: 0 },
      hiit: { count: 0, minutes: 0 },
      mobility: { count: 0, minutes: 0 },
    };
    let allMinutes = 0;
    for (const s of completedSessions) {
      totals[s.category].count += 1;
      totals[s.category].minutes += s.durationMinutes;
      allMinutes += s.durationMinutes;
    }
    return (Object.keys(CATEGORY_LABELS) as WorkoutCategory[]).map((cat) => ({
      category: cat,
      label: CATEGORY_LABELS[cat],
      count: totals[cat].count,
      minutes: totals[cat].minutes,
      pct: allMinutes > 0 ? Math.round((totals[cat].minutes / allMinutes) * 100) : 0,
    }));
  }, [completedSessions]);

  const personalRecords = useMemo(
    () => extractPersonalRecords(completedSessions),
    [completedSessions]
  );

  return (
    <div className="space-y-8">
      {/* Gemini AI Analytical Advice Card */}
      <section
        aria-label="Аналітична порада на основі ШІ"
        className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-6 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-orange-600 dark:text-orange-400 shrink-0" />
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                Аналітика та рекомендації ШІ
              </h2>
            </div>
            <p className="text-sm text-[var(--text-muted)] tabular-nums">
              {completedSessions.length > 0
                ? `Аналіз останніх тренувань (30 дн.: ${recent30dStats.totalWorkouts30d} сесій · сер. RPE ${recent30dStats.avgRpe}/10 · ${formatNumberUk(recent30dStats.totalMinutes30d)} хв)`
                : 'Запишіть перше тренування, щоб отримати персональну аналітичну пораду.'}
            </p>
          </div>

          <button
            type="button"
            disabled={adviceLoading || completedSessions.length === 0}
            onClick={() => void handleRequestAdvice()}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors"
          >
            {adviceLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Аналізую тренування...</span>
              </>
            ) : aiAdvice ? (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Оновити аналітичну пораду</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Отримати аналітичну пораду</span>
              </>
            )}
          </button>
        </div>

        {adviceError && (
          <div
            role="alert"
            className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-sm text-rose-700 dark:text-rose-300 flex items-start gap-3"
          >
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{adviceError}</span>
          </div>
        )}

        {adviceLoading && !aiAdvice && (
          <div className="p-5 rounded-2xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)] flex items-center gap-3">
            <RefreshCw className="w-4 h-4 animate-spin text-orange-600 dark:text-orange-400 shrink-0" />
            <span>
              Оцінюю останні тренування, динаміку інтенсивності (RPE), тоннаж та відновлення...
            </span>
          </div>
        )}

        {aiAdvice && (
          <div className="space-y-4 pt-2 border-t border-[var(--border-subtle)]">
            <div className="space-y-1.5">
              <h3 className="text-base sm:text-lg font-semibold text-[var(--text-primary)]">
                {aiAdvice.headline}
              </h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                {aiAdvice.summary}
              </p>
            </div>

            {aiAdvice.recommendations.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {aiAdvice.recommendations.map((rec, idx) => {
                  const meta = ADVICE_FOCUS_META[rec.focus] ?? ADVICE_FOCUS_META.intensity;
                  const FocusIcon = meta.icon;
                  return (
                    <div
                      key={`${rec.title}-${idx}`}
                      className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-2"
                    >
                      <div className={`flex items-center gap-1.5 text-xs font-semibold ${meta.accentClass}`}>
                        <FocusIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>{meta.label}</span>
                      </div>
                      <div className="text-sm font-semibold text-[var(--text-primary)]">
                        {rec.title}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        {rec.action}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="p-4 rounded-xl bg-orange-50/70 dark:bg-orange-950/25 border border-orange-200/80 dark:border-orange-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="text-xs sm:text-sm text-[var(--text-primary)]">
                <span className="font-semibold text-orange-700 dark:text-orange-400">
                  Фокус на наступне тренування:{' '}
                </span>
                <span>{aiAdvice.nextSessionFocus}</span>
              </div>
              <span className="text-[11px] font-mono text-[var(--text-muted)] shrink-0 tabular-nums">
                {new Date(aiAdvice.generatedAt).toLocaleTimeString('uk-UA', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Weekly Bar Chart + Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <section
          aria-label="Графік тижневого навантаження"
          className="lg:col-span-2 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-6 flex flex-col justify-between"
        >
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                Тижнева динаміка
              </h2>
              <p className="mt-1 text-sm text-[var(--text-muted)] tabular-nums">
                {chartMetric === 'minutes'
                  ? `Разом за тиждень: ${weekMinutesTotal} хв із цілі ${goals.minutesPerWeek} хв`
                  : `Загальний тоннаж тижня: ${formatNumberUk(weekVolumeTotal)} кг`}
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-[var(--bg-surface-muted)] rounded-xl shrink-0">
              <button
                type="button"
                onClick={() => setChartMetric('minutes')}
                className={`min-h-[38px] px-3 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  chartMetric === 'minutes'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Хвилини
              </button>
              <button
                type="button"
                onClick={() => setChartMetric('volume')}
                className={`min-h-[38px] px-3 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  chartMetric === 'volume'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Тоннаж (кг)
              </button>
            </div>
          </div>

          <div className="h-56 flex items-end gap-2 sm:gap-4 pt-6 border-b border-[var(--border-subtle)] pb-2">
            {weeklyChartData.map((d) => {
              const val = chartMetric === 'minutes' ? d.minutes : d.volume;
              const heightPct = val > 0 ? Math.max(8, Math.round((val / maxChartValue) * 100)) : 2;
              const isToday = d.date === todayDate;

              return (
                <div
                  key={d.date}
                  className="flex-1 h-full flex flex-col items-center justify-end gap-2"
                >
                  <span className="text-[11px] font-mono tabular-nums text-[var(--text-secondary)]">
                    {val > 0
                      ? chartMetric === 'minutes'
                        ? `${val}хв`
                        : formatNumberUk(val)
                      : '—'}
                  </span>
                  <div className="w-full max-w-[48px] h-36 flex items-end">
                    <div
                      className={`w-full rounded-t-lg transition-all duration-300 ${
                        val === 0
                          ? 'bg-[var(--bg-surface-muted)]'
                          : isToday
                            ? 'bg-orange-600'
                            : 'bg-slate-800 dark:bg-slate-400'
                      }`}
                      style={{ height: `${heightPct}%` }}
                      title={`${d.weekdayShort}: ${val} ${chartMetric === 'minutes' ? 'хв' : 'кг'}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-7 gap-2 sm:gap-4 pt-2.5 text-center">
            {weeklyChartData.map((d) => (
              <div key={d.date} className="text-xs font-medium text-[var(--text-secondary)]">
                <span>{d.weekdayShort}</span>
                <span className="ml-1 font-mono text-[var(--text-muted)]">{d.dayNumber}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Category Breakdown */}
        <section
          aria-label="Розподіл за типами тренувань"
          className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-6 flex flex-col justify-between"
        >
          <div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">
              Баланс навантажень
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Сумарний час за категоріями за весь період журналу.
            </p>

            <div className="mt-6 space-y-4">
              {categoryBreakdown.map((item) => (
                <div key={item.category} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-[var(--text-primary)]">{item.label}</span>
                    <span className="font-mono text-xs tabular-nums text-[var(--text-muted)]">
                      {item.minutes} хв · {item.pct}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-[var(--bg-surface-muted)] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${CATEGORY_BAR_COLORS[item.category]}`}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Усього завершених сесій</span>
            <span className="font-mono font-semibold text-[var(--text-primary)] tabular-nums">
              {completedSessions.length}
            </span>
          </div>
        </section>
      </div>

      {/* D3 30-Day Exercise Weight Progression */}
      <ExerciseWeightD3Chart todayDate={todayDate} sessions={completedSessions} />

      {/* 30-Day Muscle Body Map */}
      <MuscleBodyMap todayDate={todayDate} sessions={completedSessions} />

      {/* Full-Year Consistency & Intensity Heatmap */}
      <YearlyHeatmapChart todayDate={todayDate} sessions={completedSessions} />

      {/* Personal Records Table */}
      <section
        aria-label="Особисті рекорди"
        className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-[var(--border-subtle)] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Award className="w-5 h-5 text-orange-600 dark:text-orange-400 shrink-0" />
            <div>
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                Особисті рекорди
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Розрахунок максимуму (1ПМ) за формулою Еплі та найкращої дистанції
              </p>
            </div>
          </div>
        </div>

        {personalRecords.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--text-muted)]">
            Запишіть хоча б одне тренування з вправами, щоб побачити таблицю рекордів.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-xs font-semibold text-[var(--text-muted)]">
                  <th className="py-3 px-6">Вправа</th>
                  <th className="py-3 px-4">Група</th>
                  <th className="py-3 px-4 text-right">Найкращий результат</th>
                  <th className="py-3 px-4 text-right">Оцінка 1ПМ</th>
                  <th className="py-3 px-6 text-right">Дата</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] text-sm">
                {personalRecords.map((pr) => (
                  <tr
                    key={pr.exerciseName}
                    className="hover:bg-[var(--bg-surface-subtle)] transition-colors"
                  >
                    <td className="py-3.5 px-6 font-medium text-[var(--text-primary)]">
                      {pr.exerciseName}
                    </td>
                    <td className="py-3.5 px-4 text-[var(--text-muted)]">{pr.muscleGroup}</td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-[var(--text-primary)]">
                      {pr.trackingType === 'strength'
                        ? `${pr.bestWeightKg} кг × ${pr.bestRepsAtMax}`
                        : pr.trackingType === 'cardio'
                          ? `${pr.bestDistanceKm} км`
                          : `${Math.round(pr.bestDurationSec / 60)} хв`}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-orange-700 dark:text-orange-400 font-semibold">
                      {pr.trackingType === 'strength' ? `${pr.estimated1RmKg} кг` : '—'}
                    </td>
                    <td className="py-3.5 px-6 text-right font-mono tabular-nums text-xs text-[var(--text-muted)]">
                      {formatUkDateShort(pr.achievedDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
