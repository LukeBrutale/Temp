import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { WorkoutSession } from '../types/workout';
import {
  ExerciseWeightPoint,
  addDays,
  buildExercise30DaySeries,
  formatNumberUk,
  formatUkDateLong,
  formatUkDateShort,
  getLoggedStrengthExercises,
  parseLocalDate,
} from '../utils/workoutStats';

interface ExerciseWeightD3ChartProps {
  todayDate: string;
  sessions: WorkoutSession[];
}

export const ExerciseWeightD3Chart: React.FC<ExerciseWeightD3ChartProps> = ({
  todayDate,
  sessions,
}) => {
  const availableExercises = useMemo(
    () => getLoggedStrengthExercises(sessions),
    [sessions]
  );

  const [selectedExercise, setSelectedExercise] = useState<string>(
    () => availableExercises[0] ?? ''
  );
  const [metricMode, setMetricMode] = useState<'maxWeight' | 'e1rm'>('maxWeight');
  const [activePoint, setActivePoint] = useState<ExerciseWeightPoint | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(680);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (
      availableExercises.length > 0 &&
      !availableExercises.includes(selectedExercise)
    ) {
      setSelectedExercise(availableExercises[0]);
    }
  }, [availableExercises, selectedExercise]);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(Math.round(entry.contentRect.width));
        }
      }
    });
    observer.observe(el);
    setContainerWidth(Math.round(el.getBoundingClientRect().width) || 680);
    return () => observer.disconnect();
  }, []);

  const series = useMemo(
    () => buildExercise30DaySeries(sessions, selectedExercise, todayDate),
    [sessions, selectedExercise, todayDate]
  );

  useEffect(() => {
    setActivePoint(series.length > 0 ? series[series.length - 1] : null);
  }, [series]);

  const startDate = useMemo(() => parseLocalDate(addDays(todayDate, -29)), [todayDate]);
  const endDate = useMemo(() => parseLocalDate(todayDate), [todayDate]);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    if (series.length === 0) return;

    const width = Math.max(300, containerWidth);
    const height = 260;
    const margin = { top: 18, right: 20, bottom: 32, left: 48 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const getVal = (p: ExerciseWeightPoint) =>
      metricMode === 'maxWeight' ? p.maxWeightKg : p.estimated1RmKg;

    const values = series.map(getVal);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const padding = Math.max(5, Math.round((maxVal - minVal) * 0.25));
    const yMin = Math.max(0, Math.floor((minVal - padding) / 5) * 5);
    const yMax = Math.ceil((maxVal + padding) / 5) * 5;

    const xScale = d3
      .scaleTime()
      .domain([startDate, endDate])
      .range([0, innerWidth]);

    const yScale = d3
      .scaleLinear()
      .domain([yMin, yMax === yMin ? yMin + 10 : yMax])
      .nice()
      .range([innerHeight, 0]);

    const defs = svg.append('defs');
    const gradient = defs
      .append('linearGradient')
      .attr('id', 'd3-weight-area-grad')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    gradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#EA580C')
      .attr('stop-opacity', 0.22);
    gradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#EA580C')
      .attr('stop-opacity', 0.0);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Horizontal grid lines
    const yTicks = yScale.ticks(5);
    g.append('g')
      .selectAll('line')
      .data(yTicks)
      .join('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', 'var(--chart-grid)')
      .attr('stroke-dasharray', '3,3');

    // X Axis
    const tickCount = width < 480 ? 4 : 6;
    const xAxis = d3
      .axisBottom<Date>(xScale)
      .ticks(tickCount)
      .tickFormat((d) => {
        const dt = d as Date;
        const dd = String(dt.getDate()).padStart(2, '0');
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        return `${dd}.${mm}`;
      });

    const xAxisGroup = g
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);

    xAxisGroup.select('.domain').attr('stroke', 'var(--border-strong)');
    xAxisGroup.selectAll('.tick line').attr('stroke', 'var(--border-strong)');
    xAxisGroup
      .selectAll('.tick text')
      .attr('fill', 'var(--text-muted)')
      .attr('font-size', '11px')
      .attr('font-family', 'JetBrains Mono, monospace');

    // Y Axis
    const yAxis = d3
      .axisLeft<number>(yScale)
      .ticks(5)
      .tickFormat((d) => `${d}`);

    const yAxisGroup = g.append('g').call(yAxis);
    yAxisGroup.select('.domain').remove();
    yAxisGroup.selectAll('.tick line').remove();
    yAxisGroup
      .selectAll('.tick text')
      .attr('fill', 'var(--text-muted)')
      .attr('font-size', '11px')
      .attr('font-family', 'JetBrains Mono, monospace');

    // Y Axis unit label
    g.append('text')
      .attr('x', -margin.left + 8)
      .attr('y', -6)
      .attr('fill', 'var(--text-muted)')
      .attr('font-size', '11px')
      .text('кг');

    // Area + Line
    const parsedData = series.map((pt) => ({
      ...pt,
      dt: parseLocalDate(pt.date),
      value: getVal(pt),
    }));

    if (parsedData.length >= 2) {
      const areaGen = d3
        .area<(typeof parsedData)[number]>()
        .x((d) => xScale(d.dt))
        .y0(innerHeight)
        .y1((d) => yScale(d.value))
        .curve(d3.curveMonotoneX);

      const lineGen = d3
        .line<(typeof parsedData)[number]>()
        .x((d) => xScale(d.dt))
        .y((d) => yScale(d.value))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(parsedData)
        .attr('fill', 'url(#d3-weight-area-grad)')
        .attr('d', areaGen);

      g.append('path')
        .datum(parsedData)
        .attr('fill', 'none')
        .attr('stroke', '#EA580C')
        .attr('stroke-width', 2.5)
        .attr('stroke-linecap', 'round')
        .attr('d', lineGen);
    } else if (parsedData.length === 1) {
      // Single point reference line
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', yScale(parsedData[0].value))
        .attr('y2', yScale(parsedData[0].value))
        .attr('stroke', '#FDBA74')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,4');
    }

    // Active crosshair line
    if (activePoint) {
      const cx = xScale(parseLocalDate(activePoint.date));
      g.append('line')
        .attr('x1', cx)
        .attr('x2', cx)
        .attr('y1', 0)
        .attr('y2', innerHeight)
        .attr('stroke', '#94A3B8')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '2,2');
    }

    // Interactive Data Nodes
    const nodes = g
      .selectAll('g.d3-point')
      .data(parsedData)
      .join('g')
      .attr('class', 'd3-point')
      .attr('transform', (d) => `translate(${xScale(d.dt)},${yScale(d.value)})`)
      .style('cursor', 'pointer');

    // Invisible larger hit target for touch/hover ergonomics
    nodes
      .append('circle')
      .attr('r', 16)
      .attr('fill', 'transparent');

    nodes
      .append('circle')
      .attr('r', (d) => (activePoint?.date === d.date ? 6 : 4.5))
      .attr('fill', (d) =>
        activePoint?.date === d.date ? 'var(--text-primary)' : 'var(--bg-surface)'
      )
      .attr('stroke', '#EA580C')
      .attr('stroke-width', 2.5);

    nodes
      .append('text')
      .attr('y', -11)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('font-weight', '600')
      .attr('fill', (d) =>
        activePoint?.date === d.date ? 'var(--text-primary)' : 'var(--text-muted)'
      )
      .text((d) => `${d.value}`);

    nodes
      .on('mouseenter', (_event, d) => setActivePoint(d))
      .on('click', (_event, d) => setActivePoint(d));
  }, [series, containerWidth, metricMode, activePoint, startDate, endDate]);

  const firstVal =
    series.length > 0
      ? metricMode === 'maxWeight'
        ? series[0].maxWeightKg
        : series[0].estimated1RmKg
      : 0;
  const latestVal =
    series.length > 0
      ? metricMode === 'maxWeight'
        ? series[series.length - 1].maxWeightKg
        : series[series.length - 1].estimated1RmKg
      : 0;
  const deltaVal = Math.round((latestVal - firstVal) * 10) / 10;

  return (
    <section
      aria-label="Динаміка ваги вправи за 30 днів"
      className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">
            Динаміка ваги за 30 днів
          </h2>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            Прогресія робочої ваги та розрахункового 1ПМ для обраної силової вправи.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          {availableExercises.length > 0 && (
            <select
              value={selectedExercise}
              onChange={(e) => setSelectedExercise(e.target.value)}
              aria-label="Оберіть вправу для графіка"
              className="min-h-[42px] px-3.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-sm font-medium text-[var(--text-primary)] focus:outline-none focus:border-orange-600"
            >
              {availableExercises.map((exName) => (
                <option key={exName} value={exName}>
                  {exName}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-1 p-1 bg-[var(--bg-surface-muted)] rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setMetricMode('maxWeight')}
              className={`min-h-[36px] px-3 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                metricMode === 'maxWeight'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Макс. вага
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('e1rm')}
              className={`min-h-[36px] px-3 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                metricMode === 'e1rm'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Оцінка 1ПМ
            </button>
          </div>
        </div>
      </div>

      {availableExercises.length === 0 || series.length === 0 ? (
        <div className="py-12 text-center text-sm text-[var(--text-muted)] border-t border-[var(--border-subtle)]">
          За останні 30 днів для цієї вправи ще немає зафіксованих силових підходів з вагою.
        </div>
      ) : (
        <>
          {/* Summary KPI Strip (unboxed hairline metrics) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-3.5 border-y border-[var(--border-subtle)] mb-4">
            <div>
              <div className="text-xs text-[var(--text-muted)]">Останній результат</div>
              <div className="mt-0.5 text-lg font-mono font-semibold tabular-nums text-[var(--text-primary)]">
                {latestVal} кг
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-muted)]">Зміна за 30 днів</div>
              <div
                className={`mt-0.5 text-lg font-mono font-semibold tabular-nums ${
                  deltaVal > 0
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : deltaVal < 0
                      ? 'text-rose-700 dark:text-rose-400'
                      : 'text-[var(--text-secondary)]'
                }`}
              >
                {deltaVal > 0 ? `+${deltaVal}` : deltaVal} кг
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-muted)]">Сесій за 30 днів</div>
              <div className="mt-0.5 text-lg font-mono font-semibold tabular-nums text-[var(--text-primary)]">
                {series.length}
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-muted)]">
                {activePoint
                  ? `Обрана дата (${formatUkDateShort(activePoint.date)})`
                  : 'Деталі точки'}
              </div>
              <div className="mt-0.5 text-sm font-mono font-semibold tabular-nums text-[var(--text-primary)]">
                {activePoint
                  ? `${activePoint.maxWeightKg} кг × ${activePoint.repsAtMax} · 1ПМ ${activePoint.estimated1RmKg} кг`
                  : '—'}
              </div>
            </div>
          </div>

          {/* D3 Responsive SVG Container */}
          <div ref={wrapperRef} className="w-full overflow-hidden">
            <svg
              ref={svgRef}
              className="w-full h-[260px] select-none"
              role="img"
              aria-label={`Графік зміни ваги для вправи ${selectedExercise} за останні 30 днів`}
            />
          </div>

          {activePoint && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
              <span>
                {formatUkDateLong(activePoint.date)}
                <span aria-hidden="true"> · </span>
                Найкращий підхід:{' '}
                <span className="font-mono font-semibold text-[var(--text-primary)]">
                  {activePoint.maxWeightKg} кг × {activePoint.repsAtMax}
                </span>
                <span aria-hidden="true"> · </span>
                Тоннаж у вправі:{' '}
                <span className="font-mono font-semibold text-[var(--text-primary)]">
                  {formatNumberUk(activePoint.volumeKg)} кг
                </span>
              </span>
              <span>Наведіть або торкніться точки для перегляду</span>
            </div>
          )}
        </>
      )}
    </section>
  );
};
