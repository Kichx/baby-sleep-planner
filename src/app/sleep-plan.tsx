import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SleepPlanIcon } from '@/components/SleepPlanIcon';
import { DEFAULT_SLEEP_PLAN } from '@/constants/sleep';
import { colors, radius, spacing } from '@/constants/theme';
import type { WakeWindowPreset } from '@/types/sleep';

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  if (hours === 0) {
    return `${restMinutes} мин`;
  }

  if (restMinutes === 0) {
    return `${hours} ч`;
  }

  return `${hours} ч ${restMinutes} мин`;
}

function formatClockMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  return `${String(hours).padStart(2, '0')}:${String(restMinutes).padStart(2, '0')}`;
}

function formatWakeWindow(wakeWindow: WakeWindowPreset): string {
  return `${formatDuration(wakeWindow.minWakeMinutes)} - ${formatDuration(
    wakeWindow.maxWakeMinutes,
  )}`;
}

interface PlanMetricProps {
  label: string;
  value: string;
  caption: string;
}

function PlanMetric({ label, value, caption }: PlanMetricProps) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.metricValue}>
        {value}
      </Text>
      <Text style={styles.metricCaption}>{caption}</Text>
    </View>
  );
}

interface WakeWindowRowProps {
  wakeWindow: WakeWindowPreset;
}

function WakeWindowRow({ wakeWindow }: WakeWindowRowProps) {
  return (
    <View style={styles.wakeWindowRow}>
      <View style={styles.wakeWindowBadge}>
        <Text style={styles.wakeWindowBadgeText}>{wakeWindow.napNumber}</Text>
      </View>
      <View style={styles.wakeWindowTextBlock}>
        <Text style={styles.wakeWindowTitle}>Перед {wakeWindow.napNumber} сном</Text>
        <Text style={styles.wakeWindowCaption}>
          Цель {formatDuration(wakeWindow.targetWakeMinutes)}
        </Text>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.wakeWindowValue}>
        {formatWakeWindow(wakeWindow)}
      </Text>
    </View>
  );
}

export default function SleepPlanScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'План сна' }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
        <SafeAreaView edges={['bottom']} style={styles.safeArea}>
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <SleepPlanIcon backgroundColor={colors.primarySoft} />
            </View>
            <View style={styles.heroTextBlock}>
              <Text style={styles.heroLabel}>Текущий план</Text>
              <Text style={styles.heroTitle}>Ориентир дня</Text>
              <Text style={styles.heroText}>
                Эти значения используются для прогноза следующего сна и раннего ночного.
              </Text>
            </View>
          </View>

          <View style={styles.metricGrid}>
            <PlanMetric
              caption="в сумме за день"
              label="Бодрствование"
              value={formatDuration(DEFAULT_SLEEP_PLAN.targetAwakeMinutes)}
            />
            <PlanMetric
              caption="дневная цель"
              label="Дневной сон"
              value={formatDuration(DEFAULT_SLEEP_PLAN.targetDaySleepMinutes)}
            />
            <PlanMetric
              caption="ориентир отбоя"
              label="Ночной"
              value={formatClockMinutes(DEFAULT_SLEEP_PLAN.bedtimeTargetMinutes)}
            />
            <PlanMetric
              caption="если день перегружен"
              label="Ранний ночной"
              value={formatClockMinutes(DEFAULT_SLEEP_PLAN.earlyBedtimeMinutes)}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Окна бодрствования</Text>
            <View style={styles.wakeWindowList}>
              {DEFAULT_SLEEP_PLAN.wakeWindows.map((wakeWindow) => (
                <WakeWindowRow key={wakeWindow.napNumber} wakeWindow={wakeWindow} />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Гибкие сценарии</Text>
            <View style={styles.infoList}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Микросон</Text>
                <Text style={styles.infoValue}>
                  {formatDuration(DEFAULT_SLEEP_PLAN.microNapMinutes)}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Вечерний сон</Text>
                <Text style={styles.infoValue}>
                  до {formatClockMinutes(DEFAULT_SLEEP_PLAN.latestEveningNapEndMinutes)}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Лимит последнего сна</Text>
                <Text style={styles.infoValue}>
                  {formatDuration(DEFAULT_SLEEP_PLAN.maxEveningNapMinutes)}
                </Text>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  safeArea: {
    flex: 1,
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  hero: {
    minHeight: 126,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    backgroundColor: colors.primarySoft,
  },
  heroIcon: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 27,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  heroTextBlock: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  heroLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  heroTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
  },
  heroText: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metricCard: {
    minHeight: 118,
    flexBasis: '47%',
    flexGrow: 1,
    justifyContent: 'space-between',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  metricValue: {
    color: colors.text,
    fontSize: 25,
    fontWeight: '900',
  },
  metricCaption: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
  },
  wakeWindowList: {
    gap: spacing.xs,
  },
  wakeWindowRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  wakeWindowBadge: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: colors.primarySoft,
  },
  wakeWindowBadgeText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
  },
  wakeWindowTextBlock: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  wakeWindowTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  wakeWindowCaption: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  wakeWindowValue: {
    maxWidth: 116,
    color: colors.primary,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
  },
  infoList: {
    gap: spacing.xs,
  },
  infoRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  infoLabel: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '700',
  },
  infoValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'right',
  },
});
