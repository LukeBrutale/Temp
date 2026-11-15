import type {
  TrainingProgram,
  WeekdayIndex,
  WorkoutCategory,
  WorkoutTemplate,
} from '../types/workout.ts';

export interface CalendarExportOptions {
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  reminderMinutes: number; // 0, 15, 30, 60
  timeZone?: string;
}

export interface CompactCalendarWeek {
  n?: string;
  d: (string | null)[];
}

export interface CompactCalendarPayload {
  v: 1;
  id: string;
  t: string;
  desc?: string;
  s: string;
  tm: string;
  rm: number;
  tz?: string;
  w: CompactCalendarWeek[];
  ct?: WorkoutTemplate[];
}

export interface ScheduledCalendarEventPreview {
  uid: string;
  date: string;
  startTime: string;
  endTime: string;
  weekNumber: number;
  focusNote?: string;
  template: WorkoutTemplate;
}

const CATEGORY_LABELS_UK: Record<WorkoutCategory, string> = {
  strength: 'Силове',
  cardio: 'Кардіо',
  hiit: 'HIIT',
  mobility: 'Мобільність',
};

const WEEKDAY_INDICES: WeekdayIndex[] = [0, 1, 2, 3, 4, 5, 6];

function parseDateParts(dateStr: string): { y: number; m: number; d: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) {
    const now = new Date();
    return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
  }
  return {
    y: Number(match[1]),
    m: Number(match[2]),
    d: Number(match[3]),
  };
}

function formatDateParts(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function addCalendarDays(dateStr: string, deltaDays: number): string {
  const { y, m, d } = parseDateParts(dateStr);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return formatDateParts(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function getCalendarWeekMonday(dateStr: string): string {
  const { y, m, d } = parseDateParts(dateStr);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay(); // 0 = Sun, 1 = Mon
  const diff = day === 0 ? -6 : 1 - day;
  dt.setUTCDate(dt.getUTCDate() + diff);
  return formatDateParts(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

function parseTimeParts(timeStr: string): { hh: number; mm: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeStr.trim());
  if (!match) return { hh: 8, mm: 0 };
  const hh = Math.min(23, Math.max(0, Number(match[1])));
  const mm = Math.min(59, Math.max(0, Number(match[2])));
  return { hh, mm };
}

function addMinutesToDateTime(
  dateStr: string,
  timeStr: string,
  addMins: number
): { date: string; hh: number; mm: number } {
  const { hh, mm } = parseTimeParts(timeStr);
  const total = hh * 60 + mm + Math.max(1, addMins);
  const extraDays = Math.floor(total / 1440);
  const rem = total % 1440;
  return {
    date: extraDays > 0 ? addCalendarDays(dateStr, extraDays) : dateStr,
    hh: Math.floor(rem / 60),
    mm: rem % 60,
  };
}

function toIcsLocalTimestamp(dateStr: string, hh: number, mm: number): string {
  const { y, m, d } = parseDateParts(dateStr);
  return (
    `${String(y).padStart(4, '0')}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}` +
    `T${String(hh).padStart(2, '0')}${String(mm).padStart(2, '0')}00`
  );
}

function toIcsUtcStamp(date = new Date()): string {
  return (
    `${String(date.getUTCFullYear()).padStart(4, '0')}` +
    `${String(date.getUTCMonth() + 1).padStart(2, '0')}` +
    `${String(date.getUTCDate()).padStart(2, '0')}T` +
    `${String(date.getUTCHours()).padStart(2, '0')}` +
    `${String(date.getUTCMinutes()).padStart(2, '0')}` +
    `${String(date.getUTCSeconds()).padStart(2, '0')}Z`
  );
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

// RFC 5545 line folding: max 75 octets per line, without splitting multi-byte UTF-8 chars
function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const lines: string[] = [];
  let current = '';
  let currentBytes = 0;

  for (const char of line) {
    const charBytes = encoder.encode(char).length;
    const limit = lines.length === 0 ? 75 : 74; // continuation line has 1 leading space byte
    if (currentBytes + charBytes > limit && current.length > 0) {
      lines.push(lines.length === 0 ? current : ` ${current}`);
      current = char;
      currentBytes = charBytes;
    } else {
      current += char;
      currentBytes += charBytes;
    }
  }

  if (current.length > 0) {
    lines.push(lines.length === 0 ? current : ` ${current}`);
  }

  return lines.join('\r\n');
}

function formatExerciseSummaryLine(ex: WorkoutTemplate['exercises'][number]): string {
  if (ex.trackingType === 'strength') {
    const setsText = ex.sets
      .map((s) => `${s.weightKg} кг×${s.reps}`)
      .join(', ');
    return `• ${ex.name}: ${ex.sets.length} підх. (${setsText})`;
  }
  if (ex.trackingType === 'cardio') {
    const first = ex.sets[0];
    const dist = first?.distanceKm ? `${first.distanceKm} км` : '';
    const mins = first?.durationSec ? `${Math.round(first.durationSec / 60)} хв` : '';
    const detail = [dist, mins].filter(Boolean).join(' · ');
    return `• ${ex.name}${detail ? `: ${detail}` : ''}`;
  }
  const totalSec = ex.sets.reduce((sum, s) => sum + (s.durationSec ?? 0), 0);
  const mins = Math.max(1, Math.round(totalSec / 60));
  return `• ${ex.name}: ${ex.sets.length}× (~${mins} хв)`;
}

export function buildScheduledCalendarEvents(
  program: TrainingProgram,
  templates: WorkoutTemplate[],
  options: CalendarExportOptions
): ScheduledCalendarEventPreview[] {
  const templatesMap = new Map(templates.map((t) => [t.id, t]));
  const week1Monday = getCalendarWeekMonday(options.startDate);
  const { hh, mm } = parseTimeParts(options.startTime);
  const startLabel = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  const events: ScheduledCalendarEventPreview[] = [];

  program.weeks.forEach((week, weekIdx) => {
    for (const dayIdx of WEEKDAY_INDICES) {
      const tplId = week.days[dayIdx];
      if (!tplId) continue;
      const tpl = templatesMap.get(tplId);
      if (!tpl) continue;

      const eventDate = addCalendarDays(week1Monday, weekIdx * 7 + dayIdx);
      const endParts = addMinutesToDateTime(
        eventDate,
        startLabel,
        tpl.estimatedMinutes
      );
      const endLabel = `${String(endParts.hh).padStart(2, '0')}:${String(endParts.mm).padStart(2, '0')}`;

      events.push({
        uid: `temp-${program.id}-w${week.weekNumber}-d${dayIdx}-${eventDate}@temp.fitness`,
        date: eventDate,
        startTime: startLabel,
        endTime: endLabel,
        weekNumber: week.weekNumber,
        focusNote: week.focusNote,
        template: tpl,
      });
    }
  });

  return events;
}

export function generateProgramIcs(
  program: TrainingProgram,
  templates: WorkoutTemplate[],
  options: CalendarExportOptions
): string {
  const events = buildScheduledCalendarEvents(program, templates, options);
  const dtStamp = toIcsUtcStamp();
  const timeZone = options.timeZone || 'Europe/Kyiv';
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Temp Fitness//Training Program//UK',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(program.title)}`,
    `X-WR-CALDESC:${escapeIcsText(program.description)}`,
    `X-WR-TIMEZONE:${escapeIcsText(timeZone)}`,
  ];

  for (const ev of events) {
    const startParts = parseTimeParts(ev.startTime);
    const endInfo = addMinutesToDateTime(
      ev.date,
      ev.startTime,
      ev.template.estimatedMinutes
    );

    const descParts: string[] = [
      `Програма: ${program.title} (Тиждень ${ev.weekNumber} з ${program.durationWeeks})`,
    ];
    if (ev.focusNote) {
      descParts.push(`Фокус тижня: ${ev.focusNote}`);
    }
    descParts.push(
      `Тип: ${CATEGORY_LABELS_UK[ev.template.category]} · ~${ev.template.estimatedMinutes} хв`
    );
    if (ev.template.description) {
      descParts.push(ev.template.description);
    }
    if (ev.template.exercises.length > 0) {
      descParts.push('');
      descParts.push('План вправ:');
      for (const ex of ev.template.exercises) {
        descParts.push(formatExerciseSummaryLine(ex));
      }
    }

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${ev.uid}`);
    lines.push(`DTSTAMP:${dtStamp}`);
    lines.push(`DTSTART:${toIcsLocalTimestamp(ev.date, startParts.hh, startParts.mm)}`);
    lines.push(`DTEND:${toIcsLocalTimestamp(endInfo.date, endInfo.hh, endInfo.mm)}`);
    lines.push(
      `SUMMARY:${escapeIcsText(`${ev.template.title} · Тиж. ${ev.weekNumber}`)}`
    );
    lines.push(`DESCRIPTION:${escapeIcsText(descParts.join('\n'))}`);
    lines.push(`CATEGORIES:${escapeIcsText(CATEGORY_LABELS_UK[ev.template.category])}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('TRANSP:OPAQUE');

    if (options.reminderMinutes > 0) {
      lines.push('BEGIN:VALARM');
      lines.push(`TRIGGER:-PT${Math.round(options.reminderMinutes)}M`);
      lines.push('ACTION:DISPLAY');
      lines.push(
        `DESCRIPTION:${escapeIcsText(`Тренування через ${options.reminderMinutes} хв: ${ev.template.title}`)}`
      );
      lines.push('END:VALARM');
    }

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}

// Isomorphic UTF-8 Base64URL encoding/decoding (works in both Browser and Node)
function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(token: string): Uint8Array {
  const padded =
    token.replace(/-/g, '+').replace(/_/g, '/') +
    '==='.slice((token.length + 3) % 4);
  if (typeof atob === 'function') {
    const binary = atob(padded);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  }
  return new Uint8Array(Buffer.from(padded, 'base64'));
}

export function encodeCalendarSyncToken(
  program: TrainingProgram,
  options: CalendarExportOptions,
  customTemplates: WorkoutTemplate[] = []
): string {
  const usedIds = new Set<string>();
  for (const wk of program.weeks) {
    for (const idx of WEEKDAY_INDICES) {
      const id = wk.days[idx];
      if (id) usedIds.add(id);
    }
  }
  const relevantCustom = customTemplates.filter((t) => usedIds.has(t.id));

  const payload: CompactCalendarPayload = {
    v: 1,
    id: program.id,
    t: program.title,
    desc: program.description,
    s: getCalendarWeekMonday(options.startDate),
    tm: options.startTime,
    rm: options.reminderMinutes,
    tz: options.timeZone || 'Europe/Kyiv',
    w: program.weeks.map((wk) => ({
      ...(wk.focusNote ? { n: wk.focusNote } : {}),
      d: WEEKDAY_INDICES.map((idx) => wk.days[idx] ?? null),
    })),
    ...(relevantCustom.length > 0 ? { ct: relevantCustom } : {}),
  };

  const jsonBytes = new TextEncoder().encode(JSON.stringify(payload));
  return bytesToBase64Url(jsonBytes);
}

export function decodeCalendarSyncToken(
  token: string
): {
  program: TrainingProgram;
  options: CalendarExportOptions;
  customTemplates: WorkoutTemplate[];
} | null {
  try {
    const bytes = base64UrlToBytes(token.trim());
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as Partial<CompactCalendarPayload>;

    if (
      !parsed ||
      parsed.v !== 1 ||
      typeof parsed.t !== 'string' ||
      typeof parsed.s !== 'string' ||
      !Array.isArray(parsed.w)
    ) {
      return null;
    }

    const weeks = parsed.w.map((wk, idx) => {
      const daysArray = Array.isArray(wk.d) ? wk.d : [];
      return {
        weekNumber: idx + 1,
        focusNote: typeof wk.n === 'string' ? wk.n : undefined,
        days: {
          0: typeof daysArray[0] === 'string' ? daysArray[0] : null,
          1: typeof daysArray[1] === 'string' ? daysArray[1] : null,
          2: typeof daysArray[2] === 'string' ? daysArray[2] : null,
          3: typeof daysArray[3] === 'string' ? daysArray[3] : null,
          4: typeof daysArray[4] === 'string' ? daysArray[4] : null,
          5: typeof daysArray[5] === 'string' ? daysArray[5] : null,
          6: typeof daysArray[6] === 'string' ? daysArray[6] : null,
        },
      };
    });

    const program: TrainingProgram = {
      id: typeof parsed.id === 'string' ? parsed.id : 'shared-program',
      title: parsed.t,
      description:
        typeof parsed.desc === 'string'
          ? parsed.desc
          : `Тренувальна програма (${weeks.length} тиж.)`,
      durationWeeks: weeks.length,
      startDate: getCalendarWeekMonday(parsed.s),
      isActive: true,
      weeks,
    };

    const options: CalendarExportOptions = {
      startDate: getCalendarWeekMonday(parsed.s),
      startTime: typeof parsed.tm === 'string' ? parsed.tm : '08:00',
      reminderMinutes:
        typeof parsed.rm === 'number' && Number.isFinite(parsed.rm)
          ? Math.max(0, Math.min(180, parsed.rm))
          : 30,
      timeZone: typeof parsed.tz === 'string' ? parsed.tz : 'Europe/Kyiv',
    };

    const customTemplates = Array.isArray(parsed.ct) ? parsed.ct : [];
    return { program, options, customTemplates };
  } catch {
    return null;
  }
}

const CYRILLIC_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ye', ж: 'zh',
  з: 'z', и: 'y', і: 'i', ї: 'yi', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n',
  о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'yu', я: 'ya', ы: 'y', э: 'e', ё: 'yo',
};

export function buildIcsFilename(title: string): string {
  const transliterated = title
    .toLowerCase()
    .split('')
    .map((ch) => CYRILLIC_MAP[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${transliterated || 'training-program'}.ics`;
}
