import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import { formatLocalClock } from '@/core/localDateTime';
import { getSessionDurationMinutes } from '@/core/sleepCalculations';
import type { DayFeedItem } from '@/core/dayFeed';
import type { BottleFeeding } from '@/types/bottleFeeding';
import type { ISODateString, SleepSession } from '@/types/sleep';

type LastRecordPreviewRow =
  | {
      id: string;
      sortAt: ISODateString;
      startedAt: ISODateString;
      type: 'sleep';
      session: SleepSession;
    }
  | {
      id: string;
      sortAt: ISODateString;
      startedAt: ISODateString;
      type: 'bottleFeeding';
      feeding: BottleFeeding;
    };

interface LastRecordsPreviewProps {
  emptyText: string;
  items: DayFeedItem[];
  maxRecords?: number;
  now: Date;
  onOpenAllRecords: () => void;
  onOpenBottleFeeding: (feeding: BottleFeeding) => void;
  onOpenSleep: (session: SleepSession) => void;
  showOpenAllAction?: boolean;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  if (hours === 0) {
    return `${restMinutes} мин`;
  }

  return `${hours} ч ${restMinutes} мин`;
}

function formatSleepLine(session: SleepSession, now: Date): string {
  const startedAt = new Date(session.startedAt);
  const endedAt = session.endedAt ? new Date(session.endedAt) : null;
  const timeRange = endedAt
    ? `${formatLocalClock(startedAt)}–${formatLocalClock(endedAt)}`
    : `${formatLocalClock(startedAt)} — сейчас`;
  const duration = formatDuration(getSessionDurationMinutes(session, now));

  return `Сон · ${timeRange} · ${duration}`;
}

function formatBottleFeedingLine(feeding: BottleFeeding): string {
  return `Кормление · ${formatLocalClock(new Date(feeding.startedAt))} · ${feeding.volumeMl} мл`;
}

function buildPreviewRows(items: DayFeedItem[]): LastRecordPreviewRow[] {
  const rows = items.flatMap((item): LastRecordPreviewRow[] => {
    if (item.type === 'bottleFeeding') {
      return [
        {
          feeding: item.feeding,
          id: `feeding-${item.id}`,
          sortAt: item.sortAt,
          startedAt: item.startedAt,
          type: 'bottleFeeding',
        },
      ];
    }

    return [
      {
        id: `sleep-${item.id}`,
        session: item.session,
        sortAt: item.sortAt,
        startedAt: item.startedAt,
        type: 'sleep',
      },
      ...item.sleepFeedings.map((feeding) => ({
        feeding,
        id: `sleep-feeding-${item.id}-${feeding.id}`,
        sortAt: feeding.startedAt,
        startedAt: feeding.startedAt,
        type: 'bottleFeeding' as const,
      })),
    ];
  });

  return rows.sort((first, second) => {
    const timeDelta = new Date(second.sortAt).getTime() - new Date(first.sortAt).getTime();

    if (timeDelta !== 0) {
      return timeDelta;
    }

    if (first.type !== second.type) {
      return first.type === 'sleep' ? -1 : 1;
    }

    const startedAtDelta =
      new Date(second.startedAt).getTime() - new Date(first.startedAt).getTime();

    if (startedAtDelta !== 0) {
      return startedAtDelta;
    }

    return first.id.localeCompare(second.id);
  });
}

export function LastRecordsPreview({
  emptyText,
  items,
  maxRecords = 5,
  now,
  onOpenAllRecords,
  onOpenBottleFeeding,
  onOpenSleep,
  showOpenAllAction = true,
}: LastRecordsPreviewProps) {
  const previewRows = buildPreviewRows(items).slice(0, maxRecords);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Последние записи</Text>
        {showOpenAllAction ? (
          <Pressable
            accessibilityRole="button"
            onPress={onOpenAllRecords}
            style={({ pressed }) => [
              styles.openAllButton,
              pressed ? styles.openAllButtonPressed : null,
            ]}>
            <Text style={styles.openAllButtonText}>Все записи</Text>
          </Pressable>
        ) : null}
      </View>

      {previewRows.length === 0 ? (
        <Text style={styles.emptyText}>{emptyText}</Text>
      ) : (
        <View style={styles.rows}>
          {previewRows.map((row) => {
            const line =
              row.type === 'sleep'
                ? formatSleepLine(row.session, now)
                : formatBottleFeedingLine(row.feeding);

            return (
              <Pressable
                accessibilityLabel={`Редактировать: ${line}`}
                accessibilityRole="button"
                key={row.id}
                onPress={() =>
                  row.type === 'sleep' ? onOpenSleep(row.session) : onOpenBottleFeeding(row.feeding)
                }
                style={({ pressed }) => [
                  styles.row,
                  row.type === 'bottleFeeding' ? styles.feedingRow : null,
                  pressed ? styles.rowPressed : null,
                ]}>
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                  style={[
                    styles.rowMarker,
                    row.type === 'bottleFeeding' ? styles.feedingMarker : styles.sleepMarker,
                  ]}
                />
                <Text numberOfLines={1} style={styles.rowText}>
                  {line}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  header: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  openAllButton: {
    minHeight: 34,
    flexShrink: 0,
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
  },
  openAllButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  openAllButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  rows: {
    gap: spacing.xs,
  },
  row: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  feedingRow: {
    backgroundColor: colors.surface,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  rowMarker: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sleepMarker: {
    backgroundColor: colors.primary,
  },
  feedingMarker: {
    backgroundColor: colors.warning,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
});
