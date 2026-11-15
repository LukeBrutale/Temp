import React, { useMemo, useRef, useState } from 'react';
import {
  Download,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  BodyProfile,
  ExerciseDefinition,
  MuscleGroup,
  WeeklyGoals,
} from '../types/workout';

interface ExercisesGoalsViewProps {
  exercises: ExerciseDefinition[];
  goals: WeeklyGoals;
  bodyProfile: BodyProfile;
  onAddExercise: (ex: Omit<ExerciseDefinition, 'id'>) => void;
  onDeleteCustomExercise: (id: string) => void;
  onUpdateGoals: (goals: WeeklyGoals) => void;
  onUpdateBodyProfile: (profile: BodyProfile) => void;
  onExportJson: () => void;
  onImportJson: (raw: string) => { ok: boolean; message: string };
  onResetDemoData: () => void;
}

const MUSCLE_FILTER_OPTIONS: ('Усі' | MuscleGroup)[] = [
  'Усі',
  'Груди',
  'Спина',
  'Ноги',
  'Плечі',
  'Руки',
  'Кор',
  'Кардіо',
  'Мобільність',
];

export const ExercisesGoalsView: React.FC<ExercisesGoalsViewProps> = ({
  exercises,
  goals,
  bodyProfile,
  onAddExercise,
  onDeleteCustomExercise,
  onUpdateGoals,
  onUpdateBodyProfile,
  onExportJson,
  onImportJson,
  onResetDemoData,
}) => {
  const [muscleFilter, setMuscleFilter] = useState<'Усі' | MuscleGroup>('Усі');
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [newMuscle, setNewMuscle] = useState<MuscleGroup>('Груди');
  const [newTracking, setNewTracking] = useState<'strength' | 'cardio' | 'duration'>(
    'strength'
  );
  const [confirmReset, setConfirmReset] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredExercises = useMemo(() => {
    const q = search.trim().toLowerCase();
    return exercises
      .filter((e) => (muscleFilter === 'Усі' ? true : e.muscleGroup === muscleFilter))
      .filter((e) => (!q ? true : e.name.toLowerCase().includes(q)));
  }, [exercises, muscleFilter, search]);

  const handleCreateExercise = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    onAddExercise({
      name: trimmed,
      muscleGroup: newMuscle,
      trackingType: newTracking,
      isCustom: true,
    });
    setNewName('');
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = onImportJson(String(reader.result ?? ''));
      setImportStatus(result.message);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const bmiInfo = useMemo(() => {
    const hMeters = bodyProfile.heightCm / 100;
    if (hMeters <= 0 || bodyProfile.weightKg <= 0) {
      return null;
    }
    const bmi = Math.round((bodyProfile.weightKg / (hMeters * hMeters)) * 10) / 10;
    const minHealthyKg = Math.round(18.5 * hMeters * hMeters * 10) / 10;
    const maxHealthyKg = Math.round(24.9 * hMeters * hMeters * 10) / 10;

    let category = 'Нормальна вага';
    let colorClass = 'text-emerald-700 dark:text-emerald-400';
    if (bmi < 18.5) {
      category = 'Недостатня вага';
      colorClass = 'text-sky-700 dark:text-sky-400';
    } else if (bmi >= 25 && bmi < 30) {
      category = 'Надмірна вага';
      colorClass = 'text-amber-700 dark:text-amber-400';
    } else if (bmi >= 30) {
      category = 'Ожиріння';
      colorClass = 'text-rose-700 dark:text-rose-400';
    }

    // Map BMI [15..35] onto [0..100%] scale marker
    const markerPct = Math.min(98, Math.max(2, ((bmi - 15) / 20) * 100));

    return { bmi, category, colorClass, minHealthyKg, maxHealthyKg, markerPct };
  }, [bodyProfile.heightCm, bodyProfile.weightKg]);

  return (
    <div className="space-y-8">
      {/* Body Profile & BMI Calculator */}
      <section
        aria-label="Параметри профілю та ІМТ"
        className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-6"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-4 flex-1">
            <div>
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                Параметри тіла та ІМТ
              </h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Вкажіть поточний зріст і вагу для автоматичного розрахунку індексу маси тіла (BMI).
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
              <div>
                <label
                  htmlFor="profile-height"
                  className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
                >
                  Зріст (см)
                </label>
                <input
                  id="profile-height"
                  type="number"
                  min={100}
                  max={240}
                  step={1}
                  value={bodyProfile.heightCm || ''}
                  onChange={(e) =>
                    onUpdateBodyProfile({
                      ...bodyProfile,
                      heightCm: Math.max(0, Number(e.target.value)),
                    })
                  }
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] font-mono text-base font-semibold tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-orange-600"
                />
              </div>

              <div>
                <label
                  htmlFor="profile-weight"
                  className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
                >
                  Вага (кг)
                </label>
                <input
                  id="profile-weight"
                  type="number"
                  min={30}
                  max={250}
                  step={0.5}
                  value={bodyProfile.weightKg || ''}
                  onChange={(e) =>
                    onUpdateBodyProfile({
                      ...bodyProfile,
                      weightKg: Math.max(0, Number(e.target.value)),
                    })
                  }
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] font-mono text-base font-semibold tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-orange-600"
                />
              </div>
            </div>
          </div>

          <div className="lg:w-96 pt-4 lg:pt-0 lg:pl-6 border-t lg:border-t-0 lg:border-l border-[var(--border-subtle)] space-y-3">
            {bmiInfo ? (
              <>
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <div className="text-xs font-medium text-[var(--text-muted)]">Поточний ІМТ</div>
                    <div className="mt-0.5 text-3xl font-mono font-semibold tabular-nums text-[var(--text-primary)]">
                      {bmiInfo.bmi}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-semibold ${bmiInfo.colorClass}`}>
                      {bmiInfo.category}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] font-mono tabular-nums mt-0.5">
                      Норма: {bmiInfo.minHealthyKg}–{bmiInfo.maxHealthyKg} кг
                    </div>
                  </div>
                </div>

                {/* BMI Visual Range Bar */}
                <div className="space-y-1.5">
                  <div className="relative h-2.5 w-full rounded-full overflow-hidden flex bg-[var(--bg-surface-muted)]">
                    <div className="h-full bg-sky-500" style={{ width: '17.5%' }} />
                    <div className="h-full bg-emerald-500" style={{ width: '32.5%' }} />
                    <div className="h-full bg-amber-500" style={{ width: '25%' }} />
                    <div className="h-full bg-rose-500" style={{ width: '25%' }} />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-slate-900 dark:bg-white border-2 border-white dark:border-slate-900 shadow"
                      style={{ left: `${bmiInfo.markerPct}%` }}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="flex justify-between text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
                    <span>15</span>
                    <span>18.5</span>
                    <span>25</span>
                    <span>30</span>
                    <span>35+</span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">
                Введіть коректні зріст та вагу для розрахунку ІМТ.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Weekly Goals & Data Backup */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-6 space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">
              Персональні цілі
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Налаштуйте тижневі та денні орієнтири для кілець прогресу.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm font-medium mb-1">
                <label htmlFor="goal-workouts" className="text-[var(--text-secondary)]">
                  Тренувань на тиждень
                </label>
                <span className="font-mono tabular-nums text-[var(--text-primary)]">
                  {goals.workoutsPerWeek}
                </span>
              </div>
              <input
                id="goal-workouts"
                type="range"
                min={1}
                max={14}
                value={goals.workoutsPerWeek}
                onChange={(e) =>
                  onUpdateGoals({
                    ...goals,
                    workoutsPerWeek: Number(e.target.value),
                  })
                }
                className="w-full h-10 accent-orange-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-sm font-medium mb-1">
                <label htmlFor="goal-daily-min" className="text-[var(--text-secondary)]">
                  Денна норма активності (хв)
                </label>
                <span className="font-mono tabular-nums text-[var(--text-primary)]">
                  {goals.dailyMinutesTarget} хв
                </span>
              </div>
              <input
                id="goal-daily-min"
                type="range"
                min={15}
                max={120}
                step={5}
                value={goals.dailyMinutesTarget}
                onChange={(e) =>
                  onUpdateGoals({
                    ...goals,
                    dailyMinutesTarget: Number(e.target.value),
                  })
                }
                className="w-full h-10 accent-orange-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-sm font-medium mb-1">
                <label htmlFor="goal-weekly-min" className="text-[var(--text-secondary)]">
                  Тижнева ціль часу (хв)
                </label>
                <span className="font-mono tabular-nums text-[var(--text-primary)]">
                  {goals.minutesPerWeek} хв
                </span>
              </div>
              <input
                id="goal-weekly-min"
                type="range"
                min={60}
                max={600}
                step={15}
                value={goals.minutesPerWeek}
                onChange={(e) =>
                  onUpdateGoals({
                    ...goals,
                    minutesPerWeek: Number(e.target.value),
                  })
                }
                className="w-full h-10 accent-orange-600 cursor-pointer"
              />
            </div>
          </div>
        </section>

        <section className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-6 flex flex-col justify-between gap-5">
          <div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">
              Резервне копіювання даних
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Усі тренування автоматично зберігаються у браузері. Ви можете експортувати журнал у файл JSON або відновити його пізніше.
            </p>
            {importStatus && (
              <p className="mt-3 text-sm font-medium text-orange-700 dark:text-orange-400">{importStatus}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onExportJson}
              className="min-h-[44px] px-4 py-2 text-sm font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              Експорт JSON
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={handleFileImport}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[44px] px-4 py-2 text-sm font-semibold rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-primary)] transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <Upload className="w-4 h-4" />
              Імпорт JSON
            </button>

            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="min-h-[44px] px-4 py-2 text-sm font-medium rounded-xl text-[var(--text-secondary)] hover:text-rose-700 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4" />
                Скинути дані
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onResetDemoData();
                    setConfirmReset(false);
                    setImportStatus('Відновлено початкові дані журналу.');
                  }}
                  className="min-h-[44px] px-3.5 text-xs font-semibold rounded-xl bg-rose-600 text-white hover:bg-rose-700 whitespace-nowrap"
                >
                  Підтвердити скидання
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="min-h-[44px] px-3 text-xs font-medium rounded-xl bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] whitespace-nowrap"
                >
                  Скасувати
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Exercise Catalog */}
      <section className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">
              Довідник вправ ({filteredExercises.length})
            </h2>
            <p className="mt-0.5 text-sm text-[var(--text-muted)]">
              Додавайте власні вправи, які одразу стануть доступними під час запису тренувань.
            </p>
          </div>

          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Пошук вправи..."
              aria-label="Пошук у довіднику вправ"
              className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-orange-600"
            />
          </div>
        </div>

        {/* Add Custom Exercise Form */}
        <form
          onSubmit={handleCreateExercise}
          className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] grid grid-cols-1 sm:grid-cols-4 gap-3"
        >
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Назва нової вправи"
            aria-label="Назва нової вправи"
            className="sm:col-span-2 min-h-[44px] px-3.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-orange-600"
          />
          <select
            value={newMuscle}
            onChange={(e) => setNewMuscle(e.target.value as MuscleGroup)}
            aria-label="Група м'язів"
            className="min-h-[44px] px-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)]"
          >
            {MUSCLE_FILTER_OPTIONS.filter((m) => m !== 'Усі').map((mg) => (
              <option key={mg} value={mg}>
                {mg}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <select
              value={newTracking}
              onChange={(e) =>
                setNewTracking(e.target.value as 'strength' | 'cardio' | 'duration')
              }
              aria-label="Тип вимірювання"
              className="flex-1 min-h-[44px] px-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)]"
            >
              <option value="strength">Вага × повт.</option>
              <option value="cardio">Км × хв</option>
              <option value="duration">Час (сек)</option>
            </select>
            <button
              type="submit"
              className="min-h-[44px] px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              Додати
            </button>
          </div>
        </form>

        {/* Muscle Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {MUSCLE_FILTER_OPTIONS.map((mg) => (
            <button
              key={mg}
              type="button"
              onClick={() => setMuscleFilter(mg)}
              className={`min-h-[40px] px-3.5 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap ${
                muscleFilter === mg
                  ? 'bg-slate-900 dark:bg-orange-600 text-white'
                  : 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {mg}
            </button>
          ))}
        </div>

        {/* Exercise Rows */}
        <div className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
          {filteredExercises.map((ex) => (
            <div
              key={ex.id}
              className="py-3.5 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
                  {ex.name}
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  {ex.muscleGroup}
                  <span aria-hidden="true"> · </span>
                  {ex.trackingType === 'strength'
                    ? 'Силова'
                    : ex.trackingType === 'cardio'
                      ? 'Кардіо'
                      : 'Час'}
                  {ex.isCustom ? ' · Власна вправа' : ''}
                </div>
              </div>

              {ex.isCustom && (
                <button
                  type="button"
                  onClick={() => onDeleteCustomExercise(ex.id)}
                  aria-label={`Видалити вправу ${ex.name}`}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
