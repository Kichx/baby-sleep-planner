import { StyleSheet, Text, View, type DimensionValue } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import { addMinutes } from '@/core/sleepCalculations';
import type { SleepTimelineSegment } from '@/types/sleep';

interface SleepDayTimelineProps {
  dayStart: Date;
  segments: SleepTimelineSegment[];
}

const DAY_MINUTES = 24 * 60;
const MIN_SEGMENT_WIDTH_PERCENT = 1.4;
const MIN_LABEL_DURATION_MINUTES = 45;

function formatClock(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatShortDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  if (hours === 0) {
    return `${restMinutes} мин`;
  }

  if (restMinutes === 0) {
    return `${hours} ч`;
  }

  return `${hours}ч ${restMinutes}м`;
}

export function SleepDayTimeline({ dayStart, segments }: SleepDayTimelineProps) {
  const dayEnd = addMinutes(dayStart, DAY_MINUTES);

  return (
    <View style={styles.card}>
      <View style={styles.timeRow}>
        <Text style={styles.timeLabel}>{formatClock(dayStart)}</Text>
        <Text style={styles.timeLabel}>{formatClock(dayEnd)}</Text>
      </View>

      <View style={styles.track}>
        {segments.length === 0 ? <Text style={styles.emptyText}>Нет записей</Text> : null}
        {segments.map((segment) => {
          const leftPercent = Math.min(
            Math.max((segment.startOffsetMinutes / DAY_MINUTES) * 100, 0),
            100,
          );
          const rawWidthPercent = (segment.durationMinutes / DAY_MINUTES) * 100;
          const widthPercent = Math.min(
            Math.max(rawWidthPercent, MIN_SEGMENT_WIDTH_PERCENT),
            Math.max(100 - leftPercent, 0),
          );
          const canShowLabel = segment.durationMinutes >= MIN_LABEL_DURATION_MINUTES;

          return (
            <View
              key={segment.id}
              style={[
                styles.segment,
                segment.kind === 'night' ? styles.nightSegment : styles.napSegment,
                {
                  left: `${leftPercent}%` as DimensionValue,
                  width: `${widthPercent}%` as DimensionValue,
                },
              ]}>
              {canShowLabel ? (
                <Text
                  numberOfLines={1}
                  style={[
                    styles.segmentLabel,
                    segment.kind === 'night' ? styles.nightSegmentLabel : null,
                  ]}>
                  {formatShortDuration(segment.durationMinutes)}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendMarker, styles.napMarker]} />
          <Text style={styles.legendText}>Дневной</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendMarker, styles.nightMarker]} />
          <Text style={styles.legendText}>Ночной</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  track: {
    height: 46,
    overflow: 'hidden',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'center',
  },
  emptyText: {
    alignSelf: 'center',
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  segment: {
    position: 'absolute',
    top: 5,
    bottom: 5,
    minWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  napSegment: {
    backgroundColor: colors.primary,
  },
  nightSegment: {
    backgroundColor: colors.warning,
  },
  segmentLabel: {
    paddingHorizontal: spacing.xs,
    color: colors.surface,
    fontSize: 12,
    fontWeight: '900',
  },
  nightSegmentLabel: {
    color: colors.text,
  },
  legendRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendMarker: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  napMarker: {
    backgroundColor: colors.primary,
  },
  nightMarker: {
    backgroundColor: colors.warning,
  },
  legendText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
});
