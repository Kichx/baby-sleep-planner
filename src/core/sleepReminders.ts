import { formatLocalClock } from '@/core/localDateTime';
import type { SleepKind, SleepState } from '@/types/sleep';

export const DEFAULT_SLEEP_REMINDER_LEAD_MINUTES = 10;
export const MIN_SLEEP_REMINDER_DELAY_MINUTES = 1;

export interface NextSleepReminderInput {
  leadMinutes?: number;
  minimumDelayMinutes?: number;
  nextSleepAt: Date;
  nextSleepKind: SleepKind;
  now: Date;
  state: SleepState;
}

export interface NextSleepReminder {
  body: string;
  isDueReminder: boolean;
  kind: SleepKind;
  sleepAt: Date;
  title: string;
  triggerAt: Date;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function getReminderText(kind: SleepKind, sleepAt: Date, isDueReminder: boolean) {
  const sleepTime = formatLocalClock(sleepAt);

  if (kind === 'night') {
    return {
      body: isDueReminder
        ? 'Сейчас ориентир на отбой. Можно переходить ко сну.'
        : `Отбой примерно в ${sleepTime}. Можно начать спокойный вечер.`,
      title: 'Ориентир на отбой',
    };
  }

  return {
    body: isDueReminder
      ? 'Сейчас ориентир на сон. Если ребёнок готов, можно укладывать.'
      : `Сон примерно в ${sleepTime}. Можно спокойно начать подготовку.`,
    title: 'Ориентир на сон',
  };
}

export function buildNextSleepReminder(
  input: NextSleepReminderInput,
): NextSleepReminder | null {
  if (input.state === 'sleeping') {
    return null;
  }

  const leadMinutes = input.leadMinutes ?? DEFAULT_SLEEP_REMINDER_LEAD_MINUTES;
  const minimumDelayMinutes = input.minimumDelayMinutes ?? MIN_SLEEP_REMINDER_DELAY_MINUTES;
  const earliestTriggerAt = addMinutes(input.now, minimumDelayMinutes);

  if (input.nextSleepAt.getTime() <= earliestTriggerAt.getTime()) {
    return null;
  }

  const leadTriggerAt = addMinutes(input.nextSleepAt, -Math.max(0, leadMinutes));
  const canUseLeadReminder = leadTriggerAt.getTime() > earliestTriggerAt.getTime();
  const triggerAt = canUseLeadReminder ? leadTriggerAt : input.nextSleepAt;

  if (triggerAt.getTime() <= earliestTriggerAt.getTime()) {
    return null;
  }

  const isDueReminder = !canUseLeadReminder;
  const text = getReminderText(input.nextSleepKind, input.nextSleepAt, isDueReminder);

  return {
    body: text.body,
    isDueReminder,
    kind: input.nextSleepKind,
    sleepAt: input.nextSleepAt,
    title: text.title,
    triggerAt,
  };
}

