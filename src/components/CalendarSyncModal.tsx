import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  Copy,
  Download,
  ExternalLink,
  Link2,
  X,
} from 'lucide-react';
import { TrainingProgram, WorkoutTemplate } from '../types/workout';
import {
  addCalendarDays,
  buildIcsFilename,
  buildScheduledCalendarEvents,
  encodeCalendarSyncToken,
  generateProgramIcs,
  getCalendarWeekMonday,
} from '../utils/calendarExport';
import { formatUkDateLong, formatUkDateShort } from '../utils/workoutStats';

interface CalendarSyncModalProps {
  program: TrainingProgram;
  templates: WorkoutTemplate[];
  todayDate: string;
  onNotify?: (message: string) => void;
  onClose: () => void;
}

const TIME_PRESETS = ['07:30', '08:00', '18:00', '19:00'] as const;

export const CalendarSyncModal: React.FC<CalendarSyncModalProps> = ({
  program,
  templates,
  todayDate,
  onNotify,
  onClose,
}) => {
  const [startDate, setStartDate] = useState<string>(
    program.startDate ?? getCalendarWeekMonday(todayDate)
  );
  const [startTime, setStartTime] = useState<string>('08:00');
  const [reminderMinutes, setReminderMinutes] = useState<number>(30);
  const [copied, setCopied] = useState(false);

  const browserTimeZone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Kyiv';
    } catch {
      return 'Europe/Kyiv';
    }
  }, []);

  const week1Monday = useMemo(
    () => getCalendarWeekMonday(startDate),
    [startDate]
  );

  const cycleEndDate = useMemo(
    () => addCalendarDays(week1Monday, Math.max(1, program.durationWeeks) * 7 - 1),
    [week1Monday, program.durationWeeks]
  );

  const exportOptions = useMemo(
    () => ({
      startDate: week1Monday,
      startTime,
      reminderMinutes,
      timeZone: browserTimeZone,
    }),
    [week1Monday, startTime, reminderMinutes, browserTimeZone]
  );

  const scheduledEvents = useMemo(
    () => buildScheduledCalendarEvents(program, templates, exportOptions),
    [program, templates, exportOptions]
  );

  const customTemplates = useMemo(
    () => templates.filter((t) => !t.id.startsWith('tpl-push') && !t.id.startsWith('tpl-legs') && !t.id.startsWith('tpl-run5k') && !t.id.startsWith('tpl-hiit') && !t.id.startsWith('tpl-mobility')),
    [templates]
  );

  const syncToken = useMemo(
    () => encodeCalendarSyncToken(program, exportOptions, customTemplates),
    [program, exportOptions, customTemplates]
  );

  const syncUrls = useMemo(() => {
    const origin =
      typeof window !== 'undefined' ? window.location.origin : '';
    const httpUrl = `${origin}/api/calendar.ics?c=${syncToken}`;
    const webcalUrl = httpUrl.replace(/^https?:\/\//i, 'webcal://');
    const googleUrl = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(
      webcalUrl
    )}`;
    return { httpUrl, webcalUrl, googleUrl };
  }, [syncToken]);

  const handleDownloadIcs = () => {
    const icsContent = generateProgramIcs(program, templates, exportOptions);
    const blob = new Blob([icsContent], {
      type: 'text/calendar;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = buildIcsFilename(program.title);
    a.click();
    URL.revokeObjectURL(url);
    onNotify?.(`Завантажено календар: ${buildIcsFilename(program.title)}`);
  };

  const handleCopySyncUrl = async () => {
    try {
      await navigator.clipboard.writeText(syncUrls.httpUrl);
      setCopied(true);
      onNotify?.('Посилання для синхронізації скопійовано');
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      onNotify?.('Скопіюйте посилання вручну з поля нижче');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/55 dark:bg-slate-950/75 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="calendar-sync-title"
    >
      <div className="w-full sm:max-w-2xl max-h-[92vh] bg-[var(--bg-surface)] rounded-t-3xl sm:rounded-2xl border border-[var(--border-subtle)] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <h2
              id="calendar-sync-title"
              className="text-xl font-semibold tracking-tight text-[var(--text-primary)] truncate"
            >
              Експорт та синхронізація календаря
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)] truncate">
              {program.title} · {program.durationWeeks} тиж. ·{' '}
              <span className="font-mono tabular-nums">
                {scheduledEvents.length}
              </span>{' '}
              запланованих подій
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрити вікно експорту календаря"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Schedule Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="cal-start-date"
                className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
              >
                Тиждень старту програми
              </label>
              <input
                id="cal-start-date"
                type="date"
                value={startDate}
                onChange={(e) => {
                  if (e.target.value) setStartDate(e.target.value);
                }}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] font-mono text-sm text-[var(--text-primary)] focus:outline-none focus:border-orange-600"
              />
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                Цикл: {formatUkDateShort(week1Monday)} – {formatUkDateShort(cycleEndDate)}
              </p>
            </div>

            <div>
              <label
                htmlFor="cal-start-time"
                className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
              >
                Час початку тренувань
              </label>
              <input
                id="cal-start-time"
                type="time"
                value={startTime}
                onChange={(e) => {
                  if (e.target.value) setStartTime(e.target.value);
                }}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] font-mono text-sm text-[var(--text-primary)] focus:outline-none focus:border-orange-600"
              />
              <div className="mt-1.5 flex flex-wrap gap-1">
                {TIME_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setStartTime(preset)}
                    className={`px-2 py-0.5 text-[11px] font-mono rounded-md transition-colors ${
                      startTime === preset
                        ? 'bg-slate-900 dark:bg-orange-600 text-white'
                        : 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="cal-reminder"
                className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
              >
                Нагадування у події
              </label>
              <select
                id="cal-reminder"
                value={reminderMinutes}
                onChange={(e) => setReminderMinutes(Number(e.target.value))}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-orange-600"
              >
                <option value={0}>Без нагадування</option>
                <option value={15}>За 15 хвилин</option>
                <option value={30}>За 30 хвилин</option>
                <option value={60}>За 1 годину</option>
              </select>
              <p className="mt-1 text-[11px] text-[var(--text-muted)] truncate">
                Пояс: {browserTimeZone}
              </p>
            </div>
          </div>

          {/* Option 1: Download .ics */}
          <div className="pt-5 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
                Файл календаря (.ics)
              </h3>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Імпортуйте всі {scheduledEvents.length} тренувань зі списком вправ і підходів у Apple Calendar, Google Календар або Outlook.
              </p>
            </div>

            <button
              type="button"
              disabled={scheduledEvents.length === 0}
              onClick={handleDownloadIcs}
              className="min-h-[44px] px-4 py-2.5 text-sm font-semibold rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4" />
              Завантажити .ics
            </button>
          </div>

          {/* Option 2: Sync Link */}
          <div className="pt-5 border-t border-[var(--border-subtle)] space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Link2 className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
                Посилання для синхронізації (iCal / WebCal)
              </h3>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Підключіть календар за URL-адресою — зовнішній календар завантажить розклад напряму з сервера у форматі RFC 5545.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                readOnly
                value={syncUrls.httpUrl}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="URL-адреса синхронізації календаря"
                className="flex-1 min-h-[44px] px-3.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface-subtle)] font-mono text-xs text-[var(--text-secondary)] focus:outline-none focus:border-orange-600"
              />
              <button
                type="button"
                disabled={scheduledEvents.length === 0}
                onClick={handleCopySyncUrl}
                className="min-h-[44px] px-4 py-2 text-sm font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white disabled:opacity-50 text-white dark:text-slate-900 transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
                    Скопійовано
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Копіювати посилання
                  </>
                )}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <a
                href={syncUrls.googleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <ExternalLink className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                Додати у Google Календар
              </a>

              <a
                href={syncUrls.webcalUrl}
                className="min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                Відкрити через webcal:// (Apple / Outlook)
              </a>
            </div>
          </div>

          {/* Upcoming Events Preview */}
          <div className="pt-5 border-t border-[var(--border-subtle)] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Попередній перегляд подій
              </h4>
              <span className="text-xs font-mono tabular-nums text-[var(--text-muted)]">
                Всього: {scheduledEvents.length}
              </span>
            </div>

            {scheduledEvents.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] py-2">
                У цій програмі ще не призначено жодного тренування на дні тижня.
              </p>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)] border border-[var(--border-subtle)] rounded-xl overflow-hidden">
                {scheduledEvents.slice(0, 5).map((ev) => (
                  <div
                    key={ev.uid}
                    className="px-4 py-2.5 bg-[var(--bg-surface)] flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-sm"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-[var(--text-primary)]">
                        {ev.template.title}
                      </span>
                      <span className="ml-2 text-xs text-[var(--text-muted)]">
                        Тиждень {ev.weekNumber}
                      </span>
                    </div>
                    <div className="text-xs font-mono tabular-nums text-[var(--text-secondary)] shrink-0">
                      {formatUkDateLong(ev.date)} · {ev.startTime}–{ev.endTime}
                    </div>
                  </div>
                ))}
                {scheduledEvents.length > 5 && (
                  <div className="px-4 py-2 bg-[var(--bg-surface-subtle)] text-xs text-[var(--text-muted)]">
                    + ще {scheduledEvents.length - 5} подій до {formatUkDateShort(scheduledEvents[scheduledEvents.length - 1].date)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2 text-sm font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 transition-colors whitespace-nowrap"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
};
