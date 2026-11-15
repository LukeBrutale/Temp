import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { WORKOUT_TEMPLATES } from './src/data/templates.ts';
import type {
  AiAdviceFocus,
  AiEquipmentId,
  AiExperienceLevel,
  AiGeneratedDay,
  AiGeneratedPlan,
  AiPlanRequest,
  AiProgressAdvice,
  AiWorkoutGoal,
  MuscleGroup,
  WeekdayIndex,
  WorkoutCategory,
  WorkoutTemplate,
} from './src/types/workout.ts';
import {
  buildIcsFilename,
  decodeCalendarSyncToken,
  generateProgramIcs,
} from './src/utils/calendarExport.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GOAL_LABELS: Record<AiWorkoutGoal, string> = {
  fat_loss: 'Схуднення та рекомпозиція тіла (жироспалювання зі збереженням м’язів)',
  muscle_gain: "Набір м'язової маси (гіпертрофія та прогресія об'єму)",
  strength: 'Максимальна сила (базові силові рухи, нижчі повтори)',
  endurance: 'Витривалість та кондиція (аеробна й функціональна підготовка)',
  mobility: 'Мобільність, постава та здорове відновлення',
};

const EQUIPMENT_LABELS: Record<AiEquipmentId, string> = {
  bodyweight: 'власна вага тіла (без інвентарю)',
  dumbbells: 'гантелі',
  barbell: 'штанга, диски та лава',
  machines: 'блочні та силові тренажери залу',
  pullup_bar: 'турнік та бруси',
  kettlebell: 'гирі (kettlebell)',
  bands: 'фітнес-гумки / еспандери',
  cardio_machine: 'бігова доріжка або велотренажер',
};

const EXPERIENCE_LABELS: Record<AiExperienceLevel, string> = {
  beginner: 'початківець (акцент на базову техніку та помірний об’єм)',
  intermediate: 'середній рівень (впевнена техніка, помірний або високий об’єм)',
  advanced: 'просунутий (високий тренувальний об’єм та інтенсивність)',
};

const VALID_CATEGORIES = new Set<WorkoutCategory>([
  'strength',
  'cardio',
  'hiit',
  'mobility',
]);

const VALID_MUSCLE_GROUPS = new Set<MuscleGroup>([
  'Груди',
  'Спина',
  'Ноги',
  'Плечі',
  'Руки',
  'Кор',
  'Кардіо',
  'Мобільність',
]);

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY_MISSING');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateAndParsePlanWithRetry(
  ai: GoogleGenAI,
  prompt: string,
  systemInstruction: string
): Promise<RawAiResponse> {
  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              planTitle: {
                type: Type.STRING,
                description: 'Коротка назва програми українською (до 60 символів).',
              },
              planSummary: {
                type: Type.STRING,
                description: 'Стислий опис плану 1-2 речення (до 200 символів).',
              },
              weeklyTips: {
                type: Type.ARRAY,
                items: {
                  type: Type.STRING,
                  description: 'Одна коротка практична порада (до 120 символів).',
                },
                description: '3 короткі поради на тиждень.',
              },
              schedule: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    weekdayIndex: {
                      type: Type.INTEGER,
                      description: 'День тижня від 0 (Пн) до 6 (Нд).',
                    },
                    isRestDay: {
                      type: Type.BOOLEAN,
                      description: 'true для дня відпочинку, false для тренувального дня.',
                    },
                    restNote: {
                      type: Type.STRING,
                      description: 'Коротка порада на день відпочинку (до 80 символів).',
                    },
                    workoutTitle: {
                      type: Type.STRING,
                      description: 'Коротка назва тренування (до 50 символів).',
                    },
                    category: {
                      type: Type.STRING,
                      enum: ['strength', 'cardio', 'hiit', 'mobility'],
                    },
                    estimatedMinutes: { type: Type.INTEGER },
                    workoutDescription: {
                      type: Type.STRING,
                      description: 'Одне коротке речення про фокус тренування (до 120 символів).',
                    },
                    exercises: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: {
                            type: Type.STRING,
                            description: 'Назва вправи українською (до 50 символів).',
                          },
                          muscleGroup: {
                            type: Type.STRING,
                            enum: [
                              'Груди',
                              'Спина',
                              'Ноги',
                              'Плечі',
                              'Руки',
                              'Кор',
                              'Кардіо',
                              'Мобільність',
                            ],
                          },
                          trackingType: {
                            type: Type.STRING,
                            enum: ['strength', 'cardio', 'duration'],
                          },
                          restSeconds: { type: Type.INTEGER },
                          setsCount: { type: Type.INTEGER },
                          targetWeightKg: { type: Type.NUMBER },
                          targetReps: { type: Type.INTEGER },
                          targetDistanceKm: { type: Type.NUMBER },
                          targetDurationSec: { type: Type.INTEGER },
                        },
                        required: [
                          'name',
                          'muscleGroup',
                          'trackingType',
                          'restSeconds',
                          'setsCount',
                        ],
                      },
                    },
                  },
                  required: ['weekdayIndex', 'isRestDay'],
                },
              },
            },
            required: ['planTitle', 'planSummary', 'weeklyTips', 'schedule'],
          },
        },
      });

      const rawText = (response.text ?? '')
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '');

      if (!rawText || rawText.length > 28000) {
        throw new SyntaxError(
          `Unexpected AI JSON length (${rawText.length} chars)`
        );
      }

      const parsed = JSON.parse(rawText) as RawAiResponse;
      if (!parsed || !Array.isArray(parsed.schedule)) {
        throw new SyntaxError('Missing schedule array in AI response');
      }
      return parsed;
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isRetryable =
        err instanceof SyntaxError ||
        msg.includes('JSON') ||
        msg.includes('503') ||
        msg.includes('500') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('ECONNRESET');
      if (!isRetryable || attempt === maxAttempts - 1) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }

  throw lastError;
}

interface RawAiExercise {
  name?: string;
  muscleGroup?: string;
  trackingType?: string;
  restSeconds?: number;
  setsCount?: number;
  targetWeightKg?: number;
  targetReps?: number;
  targetDistanceKm?: number;
  targetDurationSec?: number;
}

interface RawAiDay {
  weekdayIndex?: number;
  isRestDay?: boolean;
  restNote?: string;
  workoutTitle?: string;
  category?: string;
  estimatedMinutes?: number;
  workoutDescription?: string;
  exercises?: RawAiExercise[];
}

interface RawAiResponse {
  planTitle?: string;
  planSummary?: string;
  weeklyTips?: string[];
  schedule?: RawAiDay[];
}

function normalizeAiPlan(
  raw: RawAiResponse,
  reqData: AiPlanRequest
): AiGeneratedPlan {
  const stamp = Date.now();
  const byDay = new Map<number, RawAiDay>();

  for (const item of Array.isArray(raw.schedule) ? raw.schedule : []) {
    const idx = Number(item.weekdayIndex);
    if (Number.isInteger(idx) && idx >= 0 && idx <= 6 && !byDay.has(idx)) {
      byDay.set(idx, item);
    }
  }

  const days: AiGeneratedDay[] = [];
  for (let d = 0; d <= 6; d += 1) {
    const weekdayIndex = d as WeekdayIndex;
    const rawDay = byDay.get(d);
    const hasExercises =
      rawDay && Array.isArray(rawDay.exercises) && rawDay.exercises.length > 0;

    if (!rawDay || rawDay.isRestDay || !hasExercises) {
      days.push({
        weekdayIndex,
        isRestDay: true,
        restNote:
          rawDay?.restNote?.trim() ||
          'Активне відновлення, прогулянка 7–9 тис. кроків або сон.',
      });
      continue;
    }

    const cat: WorkoutCategory = VALID_CATEGORIES.has(
      rawDay.category as WorkoutCategory
    )
      ? (rawDay.category as WorkoutCategory)
      : reqData.goal === 'fat_loss'
        ? 'hiit'
        : reqData.goal === 'mobility'
          ? 'mobility'
          : reqData.goal === 'endurance'
            ? 'cardio'
            : 'strength';

    const exercises = (rawDay.exercises ?? []).slice(0, 8).map((ex, exIdx) => {
      const trackingType: 'strength' | 'cardio' | 'duration' =
        ex.trackingType === 'cardio'
          ? 'cardio'
          : ex.trackingType === 'duration'
            ? 'duration'
            : 'strength';

      const muscleGroup: MuscleGroup = VALID_MUSCLE_GROUPS.has(
        ex.muscleGroup as MuscleGroup
      )
        ? (ex.muscleGroup as MuscleGroup)
        : trackingType === 'cardio'
          ? 'Кардіо'
          : trackingType === 'duration'
            ? 'Кор'
            : 'Груди';

      const setsCount = Math.min(6, Math.max(1, Math.round(ex.setsCount ?? 3)));
      const restSeconds = Math.min(
        240,
        Math.max(15, Math.round(ex.restSeconds ?? (cat === 'strength' ? 90 : 45)))
      );

      const weightKg = Math.max(
        0,
        Math.round((Number(ex.targetWeightKg) || 0) * 2) / 2
      );
      const reps = Math.min(50, Math.max(1, Math.round(ex.targetReps ?? 10)));
      const distanceKm = Math.max(
        0.2,
        Math.round((Number(ex.targetDistanceKm) || 3) * 10) / 10
      );
      const durationSec = Math.min(
        5400,
        Math.max(20, Math.round(ex.targetDurationSec ?? (trackingType === 'cardio' ? 1200 : 60)))
      );

      const sets = Array.from({ length: setsCount }, (_, sIdx) => ({
        id: `ai-s-${stamp}-${d}-${exIdx}-${sIdx}`,
        weightKg: trackingType === 'strength' ? weightKg : 0,
        reps: trackingType === 'strength' ? reps : 1,
        ...(trackingType === 'cardio' ? { distanceKm, durationSec } : {}),
        ...(trackingType === 'duration' ? { durationSec } : {}),
        completed: false,
      }));

      return {
        name: (ex.name || `Вправа ${exIdx + 1}`).trim(),
        muscleGroup,
        trackingType,
        restSeconds,
        sets,
      };
    });

    const template: WorkoutTemplate = {
      id: `tpl-ai-${stamp}-${d}`,
      title: (rawDay.workoutTitle || `Тренування #${d + 1}`).trim(),
      category: cat,
      estimatedMinutes: Math.min(
        120,
        Math.max(15, Math.round(rawDay.estimatedMinutes ?? reqData.durationMinutes))
      ),
      description:
        rawDay.workoutDescription?.trim() ||
        'Згенероване тренування під обрану мету та доступне обладнання.',
      exercises,
    };

    days.push({
      weekdayIndex,
      isRestDay: false,
      template,
    });
  }

  return {
    planTitle:
      raw.planTitle?.trim() ||
      `Персональний план (${reqData.daysPerWeek} дні/тиж)`,
    planSummary:
      raw.planSummary?.trim() ||
      'Збалансований тижневий план із урахуванням вашої мети, рівня підготовки та наявного інвентарю.',
    weeklyTips: (Array.isArray(raw.weeklyTips) ? raw.weeklyTips : [])
      .map((t) => String(t).trim())
      .filter(Boolean)
      .slice(0, 4),
    days,
  };
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/calendar.ics', (req, res) => {
    const rawToken = typeof req.query.c === 'string' ? req.query.c : '';
    if (!rawToken) {
      res
        .status(400)
        .type('text/plain; charset=utf-8')
        .send('Відсутній параметр синхронізації календаря.');
      return;
    }

    const decoded = decodeCalendarSyncToken(rawToken);
    if (!decoded) {
      res
        .status(400)
        .type('text/plain; charset=utf-8')
        .send('Недійсне посилання синхронізації календаря.');
      return;
    }

    const mergedTemplates = [
      ...WORKOUT_TEMPLATES,
      ...decoded.customTemplates,
    ];
    const icsContent = generateProgramIcs(
      decoded.program,
      mergedTemplates,
      decoded.options
    );
    const filename = buildIcsFilename(decoded.program.title);
    const disposition = req.query.download === '1' ? 'attachment' : 'inline';

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).send(icsContent);
  });

  app.post('/api/ai/generate-plan', async (req, res) => {
    try {
      const body = req.body as Partial<AiPlanRequest>;
      const goal: AiWorkoutGoal =
        body.goal && body.goal in GOAL_LABELS ? body.goal : 'muscle_gain';
      const equipment = Array.isArray(body.equipment)
        ? body.equipment.filter(
            (eq): eq is AiEquipmentId => eq in EQUIPMENT_LABELS
          )
        : (['bodyweight'] as AiEquipmentId[]);
      const safeEquipment: AiEquipmentId[] =
        equipment.length > 0 ? equipment : ['bodyweight'];
      const daysPerWeek = Math.min(
        6,
        Math.max(2, Math.round(Number(body.daysPerWeek) || 4))
      );
      const durationMinutes = Math.min(
        90,
        Math.max(20, Math.round(Number(body.durationMinutes) || 45))
      );
      const experienceLevel: AiExperienceLevel =
        body.experienceLevel && body.experienceLevel in EXPERIENCE_LABELS
          ? body.experienceLevel
          : 'intermediate';
      const notes =
        typeof body.notes === 'string' ? body.notes.trim().slice(0, 300) : '';

      const reqData: AiPlanRequest = {
        goal,
        equipment: safeEquipment,
        daysPerWeek,
        durationMinutes,
        experienceLevel,
        notes,
      };

      const ai = getGeminiClient();

      const systemInstruction = [
        'Ти — сертифікований тренер із силової та функціональної підготовки для спортивного додатку "Темп".',
        'Складай безпечний, реалістичний та структурований тижневий план тренувань (7 днів, weekdayIndex 0..6, де 0=Понеділок, 6=Неділя).',
        'Відповідай ВИКЛЮЧНО українською мовою.',
        'Пиши максимально лаконічно: без довгих описів, без повторень слів, без зайвих пробілів або переносів рядків усередині полів.',
        'Обов’язково використовуй ЛИШЕ вправи, які можливі з обраним користувачем обладнанням. Якщо вибрана тільки "власна вага", не додавай штанги чи тренажери.',
        'Для вправ зі штангою/гантелями вказуй реалістичну робочу вагу targetWeightKg (>0) або 0 для вправ із власною вагою, і targetReps (1-25). Для кардіо вказуй targetDistanceKm та targetDurationSec. Для планки/мобільності/інтервалів trackingType="duration" та targetDurationSec.',
        'Сформуй рівно 7 записів у масиві schedule (weekdayIndex від 0 до 6): рівно вказану кількість тренувальних днів (isRestDay: false, по 4–5 вправ на день) та дні відпочинку (isRestDay: true, без масиву exercises).',
        'Загальний обсяг JSON-відповіді має бути компактним (до 4000 символів).',
      ].join(' ');

      const equipmentText = safeEquipment
        .map((id) => EQUIPMENT_LABELS[id])
        .join(', ');

      const prompt = [
        `Мета тренувань: ${GOAL_LABELS[goal]}.`,
        `Доступне обладнання: ${equipmentText}.`,
        `Частота: ${daysPerWeek} тренувань на тиждень (рівномірно розподілити з днями відновлення).`,
        `Орієнтовна тривалість одного тренування: ~${durationMinutes} хв.`,
        `Рівень підготовки: ${EXPERIENCE_LABELS[experienceLevel]}.`,
        notes ? `Додаткові побажання користувача: ${notes}.` : '',
        'Поверни стислий валідний JSON-план українською мовою.',
      ]
        .filter(Boolean)
        .join('\n');

      const parsed = await generateAndParsePlanWithRetry(
        ai,
        prompt,
        systemInstruction
      );
      const plan = normalizeAiPlan(parsed, reqData);

      res.status(200).json(plan);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('AI plan generation failed:', msg);

      if (msg === 'GEMINI_API_KEY_MISSING' || msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED')) {
        res.status(503).json({
          error:
            'Не вдалося підключитися до сервісу ШІ. Перевірте налаштування ключа GEMINI_API_KEY у Settings > Secrets.',
        });
        return;
      }

      if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
        res.status(429).json({
          error:
            'Перевищено ліміт запитів до ШІ. Зачекайте трохи та спробуйте знову.',
        });
        return;
      }

      res.status(500).json({
        error:
          'Не вдалося згенерувати план тренувань. Спробуйте ще раз через кілька секунд.',
      });
    }
  });

  app.post('/api/ai/progress-advice', async (req, res) => {
    try {
      const body = req.body as {
        recentSessions?: {
          date: string;
          title: string;
          category: string;
          durationMinutes: number;
          rpe: number;
          volumeKg: number;
          distanceKm: number;
          muscleGroups: string[];
          exercisesSummary: string[];
          notes?: string;
        }[];
        goals?: {
          workoutsPerWeek?: number;
          minutesPerWeek?: number;
          weeklyVolumeKg?: number;
        };
        periodStats?: {
          totalWorkouts30d?: number;
          totalMinutes30d?: number;
          totalVolume30d?: number;
          avgRpe?: number;
          workoutsThisWeek?: number;
          minutesThisWeek?: number;
        };
      };

      const recentSessions = Array.isArray(body.recentSessions)
        ? body.recentSessions.slice(0, 14)
        : [];

      if (recentSessions.length === 0) {
        res.status(400).json({
          error:
            'Додайте хоча б одне завершене тренування, щоб отримати аналітичну пораду.',
        });
        return;
      }

      const ai = getGeminiClient();

      const systemInstruction = [
        'Ти — досвідчений спортивний аналітик і тренер із силової та функціональної підготовки для додатку "Темп".',
        'Проаналізуй останні тренування користувача (дату, тип, тривалість, RPE, тоннаж/дистанцію, групи м’язів, вправи та цілі) і дай короткі, конкретні, практичні рекомендації українською мовою.',
        'Обов’язково оцінюй баланс інтенсивності (RPE), тижневого обсягу, частоти та відновлення.',
        'Пиши лаконічно, без води, спираючись на реальні цифри з журналу (наприклад, пропонуй підняти робочу вагу/RPE, змінити тижневий обсяг або додати день відновлення/кардіо).',
        'Повертай суворо валідний JSON за схемою.',
      ].join(' ');

      const sessionsText = recentSessions
        .map((s, idx) => {
          const parts = [
            `${idx + 1}. ${s.date} | ${s.title} (${s.category})`,
            `${s.durationMinutes} хв, RPE ${s.rpe}/10`,
            s.volumeKg > 0 ? `тоннаж ${s.volumeKg} кг` : '',
            s.distanceKm > 0 ? `дистанція ${s.distanceKm} км` : '',
            s.muscleGroups.length > 0
              ? `м’язи: ${s.muscleGroups.join(', ')}`
              : '',
            s.exercisesSummary.length > 0
              ? `вправи: ${s.exercisesSummary.slice(0, 6).join('; ')}`
              : '',
            s.notes ? `нотатки: ${s.notes.slice(0, 120)}` : '',
          ].filter(Boolean);
          return parts.join(' · ');
        })
        .join('\n');

      const goals = body.goals ?? {};
      const stats = body.periodStats ?? {};

      const prompt = [
        `Цільові показники на тиждень: ${goals.workoutsPerWeek ?? 4} тренувань, ${goals.minutesPerWeek ?? 180} хв, тоннаж ${goals.weeklyVolumeKg ?? 10000} кг.`,
        `Поточний тиждень: ${stats.workoutsThisWeek ?? 0} тренувань, ${stats.minutesThisWeek ?? 0} хв.`,
        `За останні 30 днів: ${stats.totalWorkouts30d ?? recentSessions.length} тренувань, ${stats.totalMinutes30d ?? 0} хв, тоннаж ${stats.totalVolume30d ?? 0} кг, середній RPE ${stats.avgRpe ?? 0}/10.`,
        '',
        'Останні тренування:',
        sessionsText,
      ].join('\n');

      let parsedRaw: {
        headline?: string;
        summary?: string;
        recommendations?: {
          title?: string;
          focus?: string;
          action?: string;
        }[];
        nextSessionFocus?: string;
      } | null = null;

      let lastErr: unknown;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: prompt,
            config: {
              systemInstruction,
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  headline: {
                    type: Type.STRING,
                    description: 'Головний висновок одним коротким реченням (до 90 символів).',
                  },
                  summary: {
                    type: Type.STRING,
                    description: 'Короткий аналітичний огляд тренувань на 2–3 речення (до 320 символів).',
                  },
                  recommendations: {
                    type: Type.ARRAY,
                    description: 'Рівно 3 конкретні короткі рекомендації щодо інтенсивності, обсягу або відновлення.',
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        title: {
                          type: Type.STRING,
                          description: 'Короткий заголовок поради (до 50 символів).',
                        },
                        focus: {
                          type: Type.STRING,
                          enum: ['intensity', 'volume', 'recovery', 'balance'],
                        },
                        action: {
                          type: Type.STRING,
                          description: 'Конкретна практична дія 1–2 речення (до 180 символів).',
                        },
                      },
                      required: ['title', 'focus', 'action'],
                    },
                  },
                  nextSessionFocus: {
                    type: Type.STRING,
                    description: 'Коротка порада на наступне тренування (до 150 символів).',
                  },
                },
                required: [
                  'headline',
                  'summary',
                  'recommendations',
                  'nextSessionFocus',
                ],
              },
            },
          });

          const rawText = (response.text ?? '')
            .trim()
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/i, '');

          if (!rawText || rawText.length > 12000) {
            throw new SyntaxError('Unexpected AI advice response size');
          }

          parsedRaw = JSON.parse(rawText);
          break;
        } catch (err) {
          lastErr = err;
          const msg = err instanceof Error ? err.message : String(err);
          const retryable =
            err instanceof SyntaxError ||
            msg.includes('JSON') ||
            msg.includes('503') ||
            msg.includes('500') ||
            msg.includes('UNAVAILABLE');
          if (!retryable || attempt === 2) {
            throw err;
          }
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        }
      }

      if (!parsedRaw) {
        throw lastErr ?? new Error('Empty AI response');
      }

      const validFocus = new Set<AiAdviceFocus>([
        'intensity',
        'volume',
        'recovery',
        'balance',
      ]);

      const advice: AiProgressAdvice = {
        headline:
          parsedRaw.headline?.trim() ||
          'Аналіз останніх тренувань і рекомендації щодо прогресу',
        summary:
          parsedRaw.summary?.trim() ||
          'Ваш тренувальний графік демонструє стабільність. Зверніть увагу на поступову прогресію навантаження та відновлення.',
        recommendations: (Array.isArray(parsedRaw.recommendations)
          ? parsedRaw.recommendations
          : []
        )
          .slice(0, 4)
          .map((rec, i) => ({
            title: rec.title?.trim() || `Рекомендація #${i + 1}`,
            focus: validFocus.has(rec.focus as AiAdviceFocus)
              ? (rec.focus as AiAdviceFocus)
              : 'intensity',
            action: rec.action?.trim() || '',
          }))
          .filter((r) => r.action.length > 0),
        nextSessionFocus:
          parsedRaw.nextSessionFocus?.trim() ||
          'Сфокусуйтеся на якісній техніці та контрольованому RPE 7–8 у базових вправах.',
        generatedAt: new Date().toISOString(),
      };

      res.status(200).json(advice);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('AI progress advice failed:', msg);

      if (
        msg === 'GEMINI_API_KEY_MISSING' ||
        msg.includes('API_KEY_INVALID') ||
        msg.includes('PERMISSION_DENIED')
      ) {
        res.status(503).json({
          error:
            'Не вдалося підключитися до сервісу ШІ. Перевірте ключ GEMINI_API_KEY у Settings > Secrets.',
        });
        return;
      }

      if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
        res.status(429).json({
          error:
            'Перевищено ліміт запитів до ШІ. Спробуйте повторити через хвилину.',
        });
        return;
      }

      res.status(500).json({
        error:
          'Не вдалося сформувати аналітичну пораду. Спробуйте ще раз через кілька секунд.',
      });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
