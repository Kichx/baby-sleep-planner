export const DEFAULT_BOTTLE_FEEDING_VOLUME_ML = 90;
export const MAX_BOTTLE_FEEDING_VOLUME_ML = 999;
export const DEFAULT_BOTTLE_FEEDING_REMINDER_INTERVAL_MINUTES = 180;
export const DEFAULT_BOTTLE_FEEDING_NOTIFY_DURING_SLEEP = true;

export const QUICK_BOTTLE_FEEDING_VOLUME_ROWS = [
  [30, 60, 90, 120],
  [150, 180, 210],
] as const;

export const BOTTLE_FEEDING_REMINDER_INTERVAL_OPTIONS = [
  { label: '2 ч', value: 120 },
  { label: '2 ч 30 мин', value: 150 },
  { label: '3 ч', value: 180 },
  { label: '4 ч', value: 240 },
] as const;
