import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Timer,
  Trash2,
  X,
} from 'lucide-react';
import { sendWebNotification } from '../services/notifications';
import { ActiveSessionState, WorkoutSession } from '../types/workout';
import {
  CATEGORY_LABELS,
  formatClockTimer,
  getCompletedSetsCount,
  getSessionVolumeKg,
} from '../utils/workoutStats';

interface LiveSessionBannerProps {
  active: ActiveSessionState;
  weightReminderEnabled: boolean;
  notificationsEnabled: boolean;
  onUpdateSession: (updated: WorkoutSession) => void;
  onStartRest: (seconds: number) => void;
  onClearRest: () => void;
  onFinish: (elapsedMinutes: number) => void;
  onDiscard: () => void;
  onNotify?: (msg: string) => void;
}

export const LiveSessionBanner: React.FC<LiveSessionBannerProps> = ({
  active,
  weightReminderEnabled,
  notificationsEnabled,
  onUpdateSession,
  onStartRest,
  onClearRest,
  onFinish,
  onDiscard,
  onNotify,
}) => {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [touchedWeightExIds, setTouchedWeightExIds] = useState<Record<string, boolean>>({});
  const [weightReminderExIds, setWeightReminderExIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const elapsedSec = Math.max(0, Math.floor((nowMs - active.startedAtMs) / 1000));
  const elapsedMin = Math.max(1, Math.round(elapsedSec / 60));

  const restRemainingSec =
    active.restEndAtMs !== null
      ? Math.max(0, Math.ceil((active.restEndAtMs - nowMs) / 1000))
      : 0;

  const isRestRunning = active.restEndAtMs !== null && restRemainingSec > 0;
  const isRestFinished = active.restEndAtMs !== null && restRemainingSec === 0;

  const { done, total } = getCompletedSetsCount(active.session);
  const liveVolume = getSessionVolumeKg(active.session);

  const toggleSetDone = (exId: string, setId: string) => {
    let triggeredRestSec: number | null = null;
    let completedStrengthExName: string | null = null;

    const nextExercises = active.session.exercises.map((ex) => {
      if (ex.id !== exId) return ex;
      const wasAllCompleted =
        ex.sets.length > 0 && ex.sets.every((s) => s.completed);

      const nextSets = ex.sets.map((s) => {
        if (s.id !== setId) return s;
        const nextDone = !s.completed;
        if (nextDone && ex.restSeconds && ex.restSeconds > 0) {
          triggeredRestSec = ex.restSeconds;
        }
        return { ...s, completed: nextDone };
      });

      const isNowAllCompleted =
        nextSets.length > 0 && nextSets.every((s) => s.completed);

      if (
        ex.trackingType === 'strength' &&
        !wasAllCompleted &&
        isNowAllCompleted &&
        weightReminderEnabled
      ) {
        const hasMissingWeight = nextSets.some((s) => s.weightKg <= 0);
        if (hasMissingWeight || !touchedWeightExIds[ex.id]) {
          completedStrengthExName = ex.name;
        }
      }

      return {
        ...ex,
        sets: nextSets,
      };
    });

    onUpdateSession({ ...active.session, exercises: nextExercises });
    if (triggeredRestSec !== null) {
      onStartRest(triggeredRestSec);
    }

    if (completedStrengthExName) {
      setWeightReminderExIds((prev) => ({ ...prev, [exId]: true }));
      if (notificationsEnabled) {
        sendWebNotification(
          'Заповніть ваги після вправи',
          `«${completedStrengthExName}» завершено — перевірте та вкажіть фактичну вагу (кг) у підходах.`,
          `weight-reminder-${exId}`
        );
      }
      onNotify?.(`Нагадування: перевірте або заповніть ваги для «${completedStrengthExName}»`);
    }
  };

  const updateSetField = (
    exId: string,
    setId: string,
    field: 'weightKg' | 'reps' | 'distanceKm' | 'durationSec',
    val: number
  ) => {
    const safeVal = Math.max(0, val);
    const nextExercises = active.session.exercises.map((ex) => {
      if (ex.id !== exId) return ex;
      return {
        ...ex,
        sets: ex.sets.map((s) =>
          s.id === setId ? { ...s, [field]: safeVal } : s
        ),
      };
    });
    if (field === 'weightKg') {
      setTouchedWeightExIds((prev) => ({ ...prev, [exId]: true }));
      const targetEx = nextExercises.find((e) => e.id === exId);
      if (targetEx && targetEx.sets.every((s) => s.weightKg > 0)) {
        setWeightReminderExIds((prev) => {
          if (!prev[exId]) return prev;
          const copy = { ...prev };
          delete copy[exId];
          return copy;
        });
      }
    }
    onUpdateSession({ ...active.session, exercises: nextExercises });
  };

  const addSetToExercise = (exId: string) => {
    const nextExercises = active.session.exercises.map((ex) => {
      if (ex.id !== exId) return ex;
      const last = ex.sets[ex.sets.length - 1];
      return {
        ...ex,
        sets: [
          ...ex.sets,
          {
            id: `set-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            weightKg: last?.weightKg ?? 20,
            reps: last?.reps ?? 10,
            distanceKm: last?.distanceKm,
            durationSec: last?.durationSec,
            completed: false,
          },
        ],
      };
    });
    onUpdateSession({ ...active.session, exercises: nextExercises });
  };

  return (
    <section
      aria-label="Активне тренування"
      className="bg-slate-900 text-white rounded-2xl border border-slate-800 dark:border-slate-700 overflow-hidden"
    >
      <div className="p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-400">
            <span className="text-orange-400 font-semibold">Активна сесія</span>
            <span aria-hidden="true">·</span>
            <span>{CATEGORY_LABELS[active.session.category]}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums font-mono">
              Підходи {done}/{total}
            </span>
            {liveVolume > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums font-mono">{liveVolume} кг</span>
              </>
            )}
          </div>
          <h2 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight text-white truncate">
            {active.session.title}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="px-4 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700/80 flex items-center gap-3">
            <Timer className="w-4 h-4 text-orange-400 shrink-0" />
            <div>
              <div className="text-[11px] text-slate-400 leading-none">Тривалість</div>
              <div className="mt-1 text-xl font-mono font-semibold tabular-nums leading-none">
                {formatClockTimer(elapsedSec)}
              </div>
            </div>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-slate-800/90 border border-slate-700/80 flex items-center gap-2">
            {isRestRunning ? (
              <>
                <div>
                  <div className="text-[11px] text-orange-300 leading-none">Відпочинок</div>
                  <div className="mt-1 text-lg font-mono font-semibold tabular-nums leading-none text-orange-400">
                    {formatClockTimer(restRemainingSec)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onStartRest(restRemainingSec + 15)}
                  className="min-h-[40px] px-2.5 text-xs font-mono font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 transition-colors whitespace-nowrap shrink-0"
                >
                  +15с
                </button>
                <button
                  type="button"
                  onClick={onClearRest}
                  aria-label="Скинути таймер відпочинку"
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : isRestFinished ? (
              <>
                <span className="text-xs font-semibold text-emerald-400 whitespace-nowrap">
                  Час відпочинку вийшов
                </span>
                <button
                  type="button"
                  onClick={onClearRest}
                  className="min-h-[40px] px-3 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors whitespace-nowrap shrink-0"
                >
                  Готово
                </button>
              </>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400 mr-1 whitespace-nowrap">Пауза:</span>
                {[60, 90, 120].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => onStartRest(sec)}
                    className="min-h-[40px] px-2.5 text-xs font-mono font-medium rounded-lg bg-slate-700/80 hover:bg-slate-600 text-slate-100 transition-colors whitespace-nowrap shrink-0"
                  >
                    {sec}с
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="min-h-[44px] px-3.5 py-2 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors whitespace-nowrap shrink-0"
          >
            {expanded ? 'Згорнути вправи' : 'Показати вправи'}
          </button>

          <button
            type="button"
            onClick={() => onFinish(elapsedMin)}
            className="min-h-[44px] px-5 py-2.5 text-sm font-semibold rounded-xl bg-orange-600 hover:bg-orange-500 text-white transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Check className="w-4 h-4" />
            Завершити
          </button>

          {!confirmDiscard ? (
            <button
              type="button"
              onClick={() => setConfirmDiscard(true)}
              aria-label="Скасувати тренування"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onDiscard}
                className="min-h-[44px] px-3 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-colors whitespace-nowrap shrink-0"
              >
                Видалити сесію
              </button>
              <button
                type="button"
                onClick={() => setConfirmDiscard(false)}
                className="min-h-[44px] px-3 text-xs font-medium rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors whitespace-nowrap shrink-0"
              >
                Ні
              </button>
            </div>
          )}
        </div>
      </div>

      {expanded && active.session.exercises.length > 0 && (
        <div className="border-t border-slate-800 bg-slate-900/60 px-5 sm:px-6 py-4 space-y-5">
          {active.session.exercises.map((ex, idx) => (
            <div
              key={ex.id}
              className={idx > 0 ? 'pt-4 border-t border-slate-800/80' : ''}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">{ex.name}</h3>
                  <p className="text-xs text-slate-400">
                    {ex.muscleGroup}
                    {ex.restSeconds && ex.restSeconds > 0 ? (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span className="font-mono">Відпочинок: {ex.restSeconds}с</span>
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {ex.restSeconds && ex.restSeconds > 0 && (
                    <button
                      type="button"
                      onClick={() => onStartRest(ex.restSeconds!)}
                      className="min-h-[40px] px-3 text-xs font-mono font-medium rounded-lg bg-slate-800 hover:bg-orange-600 text-slate-200 hover:text-white transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Timer className="w-3.5 h-3.5" />
                      Пауза {ex.restSeconds}с
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => addSetToExercise(ex.id)}
                    className="min-h-[40px] px-3 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Підхід
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {ex.sets.map((set, sIdx) => (
                  <div
                    key={set.id}
                    className={`flex flex-wrap items-center gap-3 py-1.5 px-3 rounded-xl transition-colors ${
                      set.completed ? 'bg-emerald-950/50 border border-emerald-800/60' : 'bg-slate-800/50 border border-slate-800'
                    }`}
                  >
                    <span className="w-6 text-xs font-mono tabular-nums text-slate-400">
                      #{sIdx + 1}
                    </span>

                    {ex.trackingType === 'strength' && (
                      <>
                        <label className="flex items-center gap-1.5 text-xs text-slate-300">
                          <span>Вага:</span>
                          <input
                            type="number"
                            min={0}
                            step={2.5}
                            value={set.weightKg}
                            onChange={(e) =>
                              updateSetField(ex.id, set.id, 'weightKg', Number(e.target.value))
                            }
                            className="w-20 min-h-[38px] px-2.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-sm tabular-nums focus:outline-none focus:border-orange-500"
                          />
                          <span className="text-slate-400">кг</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-slate-300">
                          <span>Повтори:</span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={set.reps}
                            onChange={(e) =>
                              updateSetField(ex.id, set.id, 'reps', Number(e.target.value))
                            }
                            className="w-16 min-h-[38px] px-2.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-sm tabular-nums focus:outline-none focus:border-orange-500"
                          />
                        </label>
                      </>
                    )}

                    {ex.trackingType === 'cardio' && (
                      <>
                        <label className="flex items-center gap-1.5 text-xs text-slate-300">
                          <span>Дистанція:</span>
                          <input
                            type="number"
                            min={0}
                            step={0.1}
                            value={set.distanceKm ?? 0}
                            onChange={(e) =>
                              updateSetField(ex.id, set.id, 'distanceKm', Number(e.target.value))
                            }
                            className="w-20 min-h-[38px] px-2.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-sm tabular-nums focus:outline-none focus:border-orange-500"
                          />
                          <span className="text-slate-400">км</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-slate-300">
                          <span>Хвилин:</span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={Math.round((set.durationSec ?? 0) / 60)}
                            onChange={(e) =>
                              updateSetField(
                                ex.id,
                                set.id,
                                'durationSec',
                                Number(e.target.value) * 60
                              )
                            }
                            className="w-16 min-h-[38px] px-2.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-sm tabular-nums focus:outline-none focus:border-orange-500"
                          />
                        </label>
                      </>
                    )}

                    {ex.trackingType === 'duration' && (
                      <label className="flex items-center gap-1.5 text-xs text-slate-300">
                        <span>Тривалість (сек):</span>
                        <input
                          type="number"
                          min={0}
                          step={15}
                          value={set.durationSec ?? 60}
                          onChange={(e) =>
                            updateSetField(ex.id, set.id, 'durationSec', Number(e.target.value))
                          }
                          className="w-20 min-h-[38px] px-2.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-sm tabular-nums focus:outline-none focus:border-orange-500"
                        />
                      </label>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleSetDone(ex.id, set.id)}
                      className={`ml-auto min-h-[40px] px-3.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                        set.completed
                          ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                          : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      {set.completed ? 'Виконано' : 'Зарахувати'}
                    </button>
                  </div>
                ))}
              </div>

              {weightReminderExIds[ex.id] && (
                <div
                  role="status"
                  className="mt-3 p-3 rounded-xl bg-amber-500/15 border border-amber-400/40 text-xs text-amber-200 flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      Вправу завершено — не забудьте вказати або перевірити фактичну вагу (кг) у підходах.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTouchedWeightExIds((prev) => ({ ...prev, [ex.id]: true }));
                      setWeightReminderExIds((prev) => {
                        const copy = { ...prev };
                        delete copy[ex.id];
                        return copy;
                      });
                    }}
                    className="min-h-[34px] px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold transition-colors whitespace-nowrap shrink-0"
                  >
                    Ваги заповнено
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
