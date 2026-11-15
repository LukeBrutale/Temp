import React, { useMemo, useState } from 'react';
import { WorkoutSession } from '../types/workout';
import {
  ANATOMICAL_MUSCLE_GROUPS,
  AnatomicalMuscleGroup,
  MonthlyMuscleStat,
  buildMonthlyMuscleLoad,
  formatNumberUk,
} from '../utils/workoutStats';

interface MuscleBodyMapProps {
  todayDate: string;
  sessions: WorkoutSession[];
}

const HEAT_FILL: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'var(--heatmap-empty)',
  1: '#FFEDD5',
  2: '#FDBA74',
  3: '#F97316',
  4: '#C2410C',
};

const HEAT_STROKE: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'var(--border-strong)',
  1: '#FB923C',
  2: '#F97316',
  3: '#EA580C',
  4: '#9A3412',
};

const LEVEL_LABELS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'Без навантаження',
  1: 'Легке',
  2: 'Помірне',
  3: 'Високе',
  4: 'Пікове',
};

export const MuscleBodyMap: React.FC<MuscleBodyMapProps> = ({
  todayDate,
  sessions,
}) => {
  const [metricMode, setMetricMode] = useState<'sets' | 'volume'>('sets');
  const [selectedMuscle, setSelectedMuscle] = useState<AnatomicalMuscleGroup>('Груди');

  const allStats = useMemo(
    () => buildMonthlyMuscleLoad(sessions, todayDate, 30),
    [sessions, todayDate]
  );

  const anatomicalStats = useMemo(
    () =>
      allStats.filter((item) =>
        (ANATOMICAL_MUSCLE_GROUPS as string[]).includes(item.muscleGroup)
      ),
    [allStats]
  );

  const extraStats = useMemo(
    () =>
      allStats.filter(
        (item) =>
          !(ANATOMICAL_MUSCLE_GROUPS as string[]).includes(item.muscleGroup) &&
          item.setsCount > 0
      ),
    [allStats]
  );

  const statsMap = useMemo(() => {
    const m = new Map<string, MonthlyMuscleStat>();
    for (const s of anatomicalStats) {
      m.set(s.muscleGroup, s);
    }
    return m;
  }, [anatomicalStats]);

  // Default to the most-trained muscle if initial selection has 0 sets and another has > 0
  const activeMuscle: AnatomicalMuscleGroup = useMemo(() => {
    const current = statsMap.get(selectedMuscle);
    if (current && current.setsCount > 0) return selectedMuscle;
    const top = anatomicalStats.find((s) => s.setsCount > 0);
    return (top?.muscleGroup as AnatomicalMuscleGroup) ?? selectedMuscle;
  }, [selectedMuscle, statsMap, anatomicalStats]);

  const activeStat = statsMap.get(activeMuscle);

  const getLevel = (mg: AnatomicalMuscleGroup): 0 | 1 | 2 | 3 | 4 => {
    const stat = statsMap.get(mg);
    if (!stat) return 0;
    return metricMode === 'sets' ? stat.levelBySets : stat.levelByVolume;
  };

  const getRegionProps = (mg: AnatomicalMuscleGroup) => {
    const lvl = getLevel(mg);
    const isSelected = activeMuscle === mg;
    return {
      fill: HEAT_FILL[lvl],
      stroke: isSelected ? 'var(--text-primary)' : HEAT_STROKE[lvl],
      strokeWidth: isSelected ? 2.2 : 1.2,
      onClick: () => setSelectedMuscle(mg),
      onMouseEnter: () => setSelectedMuscle(mg),
      className: 'cursor-pointer transition-colors duration-150',
      role: 'button' as const,
      tabIndex: 0,
      'aria-label': `${mg}: ${statsMap.get(mg)?.setsCount ?? 0} підходів`,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setSelectedMuscle(mg);
        }
      },
    };
  };

  const maxBarValue = useMemo(() => {
    return Math.max(
      1,
      ...anatomicalStats.map((s) =>
        metricMode === 'sets' ? s.setsCount : s.volumeKg
      )
    );
  }, [anatomicalStats, metricMode]);

  return (
    <section
      aria-label="Карта м'язового навантаження за 30 днів"
      className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">
            Карта тіла (останні 30 днів)
          </h2>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            Групи м&apos;язів, які отримували найбільше навантаження протягом місяця.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[var(--bg-surface-muted)] rounded-xl w-fit shrink-0">
          <button
            type="button"
            onClick={() => setMetricMode('sets')}
            className={`min-h-[38px] px-3 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              metricMode === 'sets'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            За підходами
          </button>
          <button
            type="button"
            onClick={() => setMetricMode('volume')}
            className={`min-h-[38px] px-3 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              metricMode === 'volume'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            За тоннажем (кг)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Front & Back Anatomical SVG Diagrams */}
        <div className="lg:col-span-6 flex flex-col items-center">
          <div className="w-full grid grid-cols-2 gap-4 max-w-md mx-auto">
            {/* Front Silhouette */}
            <div className="flex flex-col items-center">
              <span className="text-xs font-semibold text-[var(--text-muted)] mb-2">
                Спереду
              </span>
              <svg
                viewBox="0 0 180 340"
                className="w-full max-w-[190px] h-auto select-none"
                role="img"
                aria-label="Передня проєкція тіла"
              >
                {/* Head & Neck (neutral anatomy) */}
                <circle cx="90" cy="28" r="17" fill="var(--anatomy-neutral)" stroke="var(--anatomy-stroke)" strokeWidth="1.2" />
                <rect x="81" y="45" width="18" height="14" rx="4" fill="var(--anatomy-neutral)" />

                {/* Shoulders / Deltoids (Плечі) */}
                <path
                  d="M52 63 C40 66, 35 79, 38 94 L52 94 L56 67 Z"
                  {...getRegionProps('Плечі')}
                />
                <path
                  d="M128 63 C140 66, 145 79, 142 94 L128 94 L124 67 Z"
                  {...getRegionProps('Плечі')}
                />

                {/* Chest / Pectorals (Груди) */}
                <path
                  d="M57 65 L88 67 L88 102 L55 98 Z"
                  {...getRegionProps('Груди')}
                />
                <path
                  d="M123 65 L92 67 L92 102 L125 98 Z"
                  {...getRegionProps('Груди')}
                />

                {/* Core / Abs (Кор) */}
                <path
                  d="M62 105 L118 105 L114 162 L66 162 Z"
                  {...getRegionProps('Кор')}
                />
                {/* Subtle ab segment lines */}
                <line x1="90" y1="108" x2="90" y2="158" stroke="#94A3B8" strokeOpacity="0.35" strokeWidth="1" pointerEvents="none" />
                <line x1="66" y1="124" x2="114" y2="124" stroke="#94A3B8" strokeOpacity="0.3" strokeWidth="1" pointerEvents="none" />
                <line x1="67" y1="142" x2="113" y2="142" stroke="#94A3B8" strokeOpacity="0.3" strokeWidth="1" pointerEvents="none" />

                {/* Arms / Biceps & Forearms (Руки) */}
                <path
                  d="M38 97 L52 97 L48 134 L34 134 Z"
                  {...getRegionProps('Руки')}
                />
                <path
                  d="M34 137 L47 137 L42 174 L30 172 Z"
                  {...getRegionProps('Руки')}
                />
                <path
                  d="M142 97 L128 97 L132 134 L146 134 Z"
                  {...getRegionProps('Руки')}
                />
                <path
                  d="M146 137 L133 137 L138 174 L150 172 Z"
                  {...getRegionProps('Руки')}
                />

                {/* Pelvis / Hip connector */}
                <path
                  d="M65 165 L115 165 L122 186 L92 192 L88 192 L58 186 Z"
                  fill="var(--anatomy-neutral)"
                  stroke="var(--anatomy-stroke)"
                  strokeWidth="1"
                />

                {/* Legs / Quads & Calves (Ноги) */}
                <path
                  d="M58 190 L87 195 L83 255 L56 255 Z"
                  {...getRegionProps('Ноги')}
                />
                <path
                  d="M57 260 L82 260 L77 322 L61 322 Z"
                  {...getRegionProps('Ноги')}
                />
                <path
                  d="M122 190 L93 195 L97 255 L124 255 Z"
                  {...getRegionProps('Ноги')}
                />
                <path
                  d="M123 260 L98 260 L103 322 L119 322 Z"
                  {...getRegionProps('Ноги')}
                />
              </svg>
            </div>

            {/* Back Silhouette */}
            <div className="flex flex-col items-center">
              <span className="text-xs font-semibold text-[var(--text-muted)] mb-2">
                Ззаду
              </span>
              <svg
                viewBox="0 0 180 340"
                className="w-full max-w-[190px] h-auto select-none"
                role="img"
                aria-label="Задня проєкція тіла"
              >
                {/* Head & Neck */}
                <circle cx="90" cy="28" r="17" fill="var(--anatomy-neutral)" stroke="var(--anatomy-stroke)" strokeWidth="1.2" />
                <rect x="81" y="45" width="18" height="14" rx="4" fill="var(--anatomy-neutral)" />

                {/* Rear Deltoids (Плечі) */}
                <path
                  d="M52 63 C40 66, 35 79, 38 94 L52 94 L56 67 Z"
                  {...getRegionProps('Плечі')}
                />
                <path
                  d="M128 63 C140 66, 145 79, 142 94 L128 94 L124 67 Z"
                  {...getRegionProps('Плечі')}
                />

                {/* Upper & Mid Back / Traps & Lats (Спина) */}
                <path
                  d="M57 65 L80 57 L100 57 L123 65 L127 104 L115 148 L90 154 L65 148 L53 104 Z"
                  {...getRegionProps('Спина')}
                />
                <line x1="90" y1="60" x2="90" y2="150" stroke="#94A3B8" strokeOpacity="0.35" strokeWidth="1" pointerEvents="none" />

                {/* Arms / Triceps & Forearms (Руки) */}
                <path
                  d="M38 97 L52 97 L48 134 L34 134 Z"
                  {...getRegionProps('Руки')}
                />
                <path
                  d="M34 137 L47 137 L42 174 L30 172 Z"
                  {...getRegionProps('Руки')}
                />
                <path
                  d="M142 97 L128 97 L132 134 L146 134 Z"
                  {...getRegionProps('Руки')}
                />
                <path
                  d="M146 137 L133 137 L138 174 L150 172 Z"
                  {...getRegionProps('Руки')}
                />

                {/* Glutes & Hamstrings & Calves (Ноги) */}
                <path
                  d="M64 156 L88 160 L88 194 L58 188 Z"
                  {...getRegionProps('Ноги')}
                />
                <path
                  d="M116 156 L92 160 L92 194 L122 188 Z"
                  {...getRegionProps('Ноги')}
                />
                <path
                  d="M58 196 L87 198 L83 255 L56 255 Z"
                  {...getRegionProps('Ноги')}
                />
                <path
                  d="M57 260 L82 260 L77 322 L61 322 Z"
                  {...getRegionProps('Ноги')}
                />
                <path
                  d="M122 196 L93 198 L97 255 L124 255 Z"
                  {...getRegionProps('Ноги')}
                />
                <path
                  d="M123 260 L98 260 L103 322 L119 322 Z"
                  {...getRegionProps('Ноги')}
                />
              </svg>
            </div>
          </div>

          {/* Heat Legend */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs text-[var(--text-muted)]">
            <span>Менше</span>
            {([0, 1, 2, 3, 4] as const).map((lvl) => (
              <span
                key={lvl}
                className="inline-flex items-center gap-1"
                title={LEVEL_LABELS[lvl]}
              >
                <span
                  className="w-3.5 h-3.5 rounded border"
                  style={{
                    backgroundColor: HEAT_FILL[lvl],
                    borderColor: HEAT_STROKE[lvl],
                  }}
                />
              </span>
            ))}
            <span>Найбільше</span>
          </div>
        </div>

        {/* Right: Selected Muscle Detail + Ranked Breakdown */}
        <div className="lg:col-span-6 space-y-5">
          {/* Active Muscle Telemetry */}
          {activeStat && (
            <div className="p-4 sm:p-5 rounded-xl bg-slate-900 dark:bg-slate-800/90 border border-slate-800 dark:border-slate-700 text-white space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="text-xs text-slate-400">Обрана група м&apos;язів</span>
                  <h3 className="text-xl font-semibold text-white">
                    {activeStat.muscleGroup}
                  </h3>
                </div>
                <span className="text-xs font-semibold text-orange-400">
                  {LEVEL_LABELS[
                    metricMode === 'sets'
                      ? activeStat.levelBySets
                      : activeStat.levelByVolume
                  ]}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-800 dark:border-slate-700">
                <div>
                  <div className="text-[11px] text-slate-400">Підходів</div>
                  <div className="mt-0.5 text-lg font-mono font-semibold tabular-nums">
                    {activeStat.setsCount}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Тренувань</div>
                  <div className="mt-0.5 text-lg font-mono font-semibold tabular-nums">
                    {activeStat.sessionsCount}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Тоннаж</div>
                  <div className="mt-0.5 text-lg font-mono font-semibold tabular-nums">
                    {activeStat.volumeKg > 0
                      ? `${formatNumberUk(activeStat.volumeKg)} кг`
                      : '—'}
                  </div>
                </div>
              </div>

              {activeStat.topExercises.length > 0 && (
                <div className="pt-2 border-t border-slate-800 dark:border-slate-700 text-xs text-slate-300">
                  <span className="text-slate-400">Основні вправи: </span>
                  <span>{activeStat.topExercises.join(' · ')}</span>
                </div>
              )}
            </div>
          )}

          {/* Ranked Muscle List */}
          <div className="space-y-2">
            {anatomicalStats.map((stat) => {
              const mg = stat.muscleGroup as AnatomicalMuscleGroup;
              const isSelected = activeMuscle === mg;
              const value = metricMode === 'sets' ? stat.setsCount : stat.volumeKg;
              const pct = value > 0 ? Math.max(4, Math.round((value / maxBarValue) * 100)) : 0;
              const lvl = metricMode === 'sets' ? stat.levelBySets : stat.levelByVolume;

              return (
                <button
                  key={stat.muscleGroup}
                  type="button"
                  onClick={() => setSelectedMuscle(mg)}
                  className={`w-full text-left p-3 rounded-xl border transition-colors ${
                    isSelected
                      ? 'border-slate-900 dark:border-orange-500 bg-[var(--bg-surface-subtle)]'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-subtle)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 text-sm mb-1.5">
                    <span className="font-semibold text-[var(--text-primary)]">
                      {stat.muscleGroup}
                    </span>
                    <span className="text-xs font-mono tabular-nums text-[var(--text-secondary)]">
                      {stat.setsCount} підх.
                      {stat.volumeKg > 0 ? ` · ${formatNumberUk(stat.volumeKg)} кг` : ''}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-[var(--bg-surface-muted)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${pct}%`,
                        backgroundColor:
                          lvl === 0 ? 'var(--border-strong)' : HEAT_FILL[lvl],
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {extraStats.length > 0 && (
            <p className="text-xs text-[var(--text-muted)] pt-1">
              Додатково за 30 днів:{' '}
              {extraStats
                .map((s) => `${s.muscleGroup} (${s.sessionsCount} трен.)`)
                .join(' · ')}
            </p>
          )}
        </div>
      </div>
    </section>
  );
};
