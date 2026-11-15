import React, { useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { WorkoutSession } from '../types/workout';
import {
  YearlyHeatmapCell,
  buildYearlyHeatmap,
  formatNumberUk,
  formatUkDateLong,
  formatUkDateShort,
  parseLocalDate,
} from '../utils/workoutStats';

interface YearlyHeatmapChartProps {
  todayDate: string;
  sessions: WorkoutSession[];
}

const WEEKDAY_AXIS_LABELS: { row: number; label: string }[] = [
  { row: 0, label: 'Пн' },
  { row: 2, label: 'Ср' },
  { row: 4, label: 'Пт' },
  { row: 6, label: 'Нд' },
];

const LEVEL_COLORS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'var(--heatmap-empty)',
  1: '#FED7AA',
  2: '#FB923C',
  3: '#EA580C',
  4: 'var(--heatmap-peak)',
};

const LEVEL_LABELS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'Відпочинок',
  1: 'Легка',
  2: 'Помірна',
  3: 'Висока',
  4: 'Пікова',
};

export const YearlyHeatmapChart: React.FC<YearlyHeatmapChartProps> = ({
  todayDate,
  sessions,
}) => {
  const currentYear = useMemo(
    () => parseLocalDate(todayDate).getFullYear(),
    [todayDate]
  );

  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear]);
    for (const s of sessions) {
      if (!s.completed) continue;
      const y = Number(s.date.slice(0, 4));
      if (Number.isFinite(y) && y > 2000) years.add(y);
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [sessions, currentYear]);

  const [periodMode, setPeriodMode] = useState<'rolling' | 'year'>('rolling');
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [metricMode, setMetricMode] = useState<'intensity' | 'frequency'>('intensity');
  const [inspectedDate, setInspectedDate] = useState<string | null>(todayDate);

  const heatmap = useMemo(
    () => buildYearlyHeatmap(sessions, todayDate, periodMode, selectedYear),
    [sessions, todayDate, periodMode, selectedYear]
  );

  const activeCell: YearlyHeatmapCell | undefined = useMemo(() => {
    const target = inspectedDate
      ? heatmap.cells.find((c) => c.date === inspectedDate && c.inRange && !c.isFuture)
      : undefined;
    if (target) return target;
    return (
      heatmap.cells.find((c) => c.date === todayDate && c.inRange) ??
      heatmap.cells.find((c) => c.inRange && !c.isFuture && c.workoutsCount > 0)
    );
  }, [heatmap.cells, inspectedDate, todayDate]);

  const cellSize = 13;
  const cellGap = 3;
  const step = cellSize + cellGap;
  const leftPad = 26;
  const topPad = 20;
  const svgWidth = leftPad + heatmap.weeksCount * step + 4;
  const svgHeight = topPad + 7 * step + 4;

  const activePct =
    heatmap.summary.totalRangeDays > 0
      ? Math.round(
          (heatmap.summary.activeDays / heatmap.summary.totalRangeDays) * 100
        )
      : 0;
  const totalHours = Math.round((heatmap.summary.totalMinutes / 60) * 10) / 10;

  return (
    <section
      aria-label="Річний графік частоти та інтенсивності тренувань"
      className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-6 space-y-5"
    >
      {/* Header & Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">
              Річний Heatmap активності
            </h2>
            <p className="mt-0.5 text-sm text-[var(--text-muted)]">
              {periodMode === 'rolling'
                ? `Останні 12 місяців (${formatUkDateShort(heatmap.rangeStart)} – ${formatUkDateShort(heatmap.rangeEnd)})`
                : `Календарний ${selectedYear} рік`}
              {' · '}
              {metricMode === 'intensity'
                ? 'Колір показує денне навантаження (тривалість × RPE)'
                : 'Колір показує частоту сесій та тривалість за день'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Period Switcher */}
          <div className="flex items-center gap-1 p-1 bg-[var(--bg-surface-muted)] rounded-xl">
            <button
              type="button"
              onClick={() => setPeriodMode('rolling')}
              className={`min-h-[38px] px-3 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                periodMode === 'rolling'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              365 днів
            </button>
            {availableYears.map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => {
                  setPeriodMode('year');
                  setSelectedYear(yr);
                }}
                className={`min-h-[38px] px-3 text-xs font-mono font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  periodMode === 'year' && selectedYear === yr
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>

          {/* Metric Switcher */}
          <div className="flex items-center gap-1 p-1 bg-[var(--bg-surface-muted)] rounded-xl">
            <button
              type="button"
              onClick={() => setMetricMode('intensity')}
              className={`min-h-[38px] px-3 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                metricMode === 'intensity'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Інтенсивність
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('frequency')}
              className={`min-h-[38px] px-3 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                metricMode === 'frequency'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Частота і час
            </button>
          </div>
        </div>
      </div>

      {/* Annual Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 py-4 border-y border-[var(--border-subtle)]">
        <div>
          <p className="text-xs font-medium text-[var(--text-muted)]">Активних днів</p>
          <p className="mt-1 text-xl font-mono font-semibold tabular-nums text-[var(--text-primary)]">
            {heatmap.summary.activeDays}
            <span className="text-sm font-normal text-[var(--text-muted)]">
              /{heatmap.summary.totalRangeDays}
            </span>
            <span className="ml-2 text-xs font-semibold text-orange-700 dark:text-orange-400">
              {activePct}%
            </span>
          </p>
        </div>

        <div>
          <p className="text-xs font-medium text-[var(--text-muted)]">Частота за період</p>
          <p className="mt-1 text-xl font-mono font-semibold tabular-nums text-[var(--text-primary)]">
            {heatmap.summary.totalWorkouts}{' '}
            <span className="text-xs font-sans font-normal text-[var(--text-muted)]">
              трен. · {totalHours} год
            </span>
          </p>
        </div>

        <div>
          <p className="text-xs font-medium text-[var(--text-muted)]">Середня інтенсивність</p>
          <p className="mt-1 text-xl font-mono font-semibold tabular-nums text-[var(--text-primary)]">
            {heatmap.summary.avgRpe > 0 ? `RPE ${heatmap.summary.avgRpe}` : '—'}
            {heatmap.summary.avgRpe > 0 && (
              <span className="text-sm font-normal text-[var(--text-muted)]">/10</span>
            )}
          </p>
        </div>

        <div>
          <p className="text-xs font-medium text-[var(--text-muted)]">Найдовша серія</p>
          <p className="mt-1 text-xl font-mono font-semibold tabular-nums text-[var(--text-primary)]">
            {heatmap.summary.longestStreak}{' '}
            <span className="text-xs font-sans font-normal text-[var(--text-muted)]">
              дн. · топ: {heatmap.summary.mostActiveWeekday}
            </span>
          </p>
        </div>
      </div>

      {/* Full-Year SVG Heatmap Grid */}
      <div className="overflow-x-auto pb-1">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full min-w-[700px] h-auto select-none block"
          role="img"
          aria-label="Теплова карта тренувань за рік"
        >
          {/* Month labels */}
          {heatmap.monthLabels.map((m) => (
            <text
              key={`${m.weekIndex}-${m.label}`}
              x={leftPad + m.weekIndex * step}
              y={12}
              fill="var(--text-muted)"
              className="text-[10px] font-medium"
            >
              {m.label}
            </text>
          ))}

          {/* Weekday axis labels */}
          {WEEKDAY_AXIS_LABELS.map((wd) => (
            <text
              key={wd.row}
              x={0}
              y={topPad + wd.row * step + cellSize - 2}
              fill="var(--text-muted)"
              className="text-[10px] font-medium"
            >
              {wd.label}
            </text>
          ))}

          {/* Day cells */}
          {heatmap.cells.map((cell) => {
            if (!cell.inRange) return null;

            const x = leftPad + cell.weekIndex * step;
            const y = topPad + cell.weekdayIndex * step;
            const level =
              metricMode === 'intensity'
                ? cell.intensityLevel
                : cell.frequencyLevel;
            const fill = cell.isFuture ? 'var(--bg-surface)' : LEVEL_COLORS[level];
            const isSelected = activeCell?.date === cell.date;
            const isToday = cell.date === todayDate;

            const stroke = cell.isFuture
              ? 'var(--border-subtle)'
              : isSelected
                ? 'var(--text-primary)'
                : isToday
                  ? '#EA580C'
                  : 'transparent';

            const strokeWidth = isSelected || isToday ? 1.6 : cell.isFuture ? 1 : 0;

            const labelText = cell.isFuture
              ? `${formatUkDateShort(cell.date)}: майбутній день`
              : cell.workoutsCount > 0
                ? `${formatUkDateShort(cell.date)}: ${cell.workoutsCount} трен., ${cell.minutes} хв, RPE ${cell.avgRpe}/10`
                : `${formatUkDateShort(cell.date)}: відпочинок`;

            return (
              <rect
                key={cell.date}
                x={x}
                y={y}
                width={cellSize}
                height={cellSize}
                rx={2.5}
                ry={2.5}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
                className={cell.isFuture ? 'cursor-default' : 'cursor-pointer'}
                tabIndex={cell.isFuture ? -1 : 0}
                aria-label={labelText}
                onMouseEnter={() => {
                  if (!cell.isFuture) setInspectedDate(cell.date);
                }}
                onFocus={() => {
                  if (!cell.isFuture) setInspectedDate(cell.date);
                }}
                onClick={() => {
                  if (!cell.isFuture) setInspectedDate(cell.date);
                }}
              >
                <title>{labelText}</title>
              </rect>
            );
          })}
        </svg>
      </div>

      {/* Interactive Day Details + Intensity Legend */}
      <div className="pt-3 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0 text-sm">
          {activeCell ? (
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="font-semibold text-[var(--text-primary)]">
                {formatUkDateLong(activeCell.date)}
              </span>
              <span className="text-[var(--border-strong)]" aria-hidden="true">
                ·
              </span>
              {activeCell.workoutsCount > 0 ? (
                <>
                  <span className="font-mono tabular-nums text-[var(--text-primary)]">
                    {activeCell.workoutsCount} трен. · {activeCell.minutes} хв
                  </span>
                  <span className="text-[var(--border-strong)]" aria-hidden="true">
                    ·
                  </span>
                  <span className="font-mono tabular-nums text-orange-700 dark:text-orange-400 font-semibold">
                    RPE {activeCell.avgRpe}/10 ({LEVEL_LABELS[activeCell.intensityLevel]})
                  </span>
                  {activeCell.volumeKg > 0 && (
                    <>
                      <span className="text-[var(--border-strong)]" aria-hidden="true">
                        ·
                      </span>
                      <span className="font-mono tabular-nums text-[var(--text-secondary)]">
                        {formatNumberUk(activeCell.volumeKg)} кг
                      </span>
                    </>
                  )}
                  {activeCell.titles.length > 0 && (
                    <span className="text-xs text-[var(--text-muted)] truncate max-w-md">
                      — {activeCell.titles.join(', ')}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-[var(--text-muted)]">День відновлення (0 тренувань)</span>
              )}
            </div>
          ) : (
            <span className="text-[var(--text-muted)]">
              Наведіть або натисніть на клітинку для деталей дня
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] shrink-0">
          <span>Менше</span>
          {([0, 1, 2, 3, 4] as const).map((lvl) => (
            <span
              key={lvl}
              title={LEVEL_LABELS[lvl]}
              className="w-3.5 h-3.5 rounded-[3px] border border-[var(--border-subtle)] inline-block"
              style={{ backgroundColor: LEVEL_COLORS[lvl] }}
            />
          ))}
          <span>Більше</span>
        </div>
      </div>
    </section>
  );
};
