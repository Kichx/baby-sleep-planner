import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import type { SleepCoachCardVm, SleepCoachTone } from '@/core/mainScreenSleepCoach';

export type SleepCoachCardProps = {
  vm: SleepCoachCardVm;
  onOpenWhy?: () => void;
  onOpenAlternatives?: () => void;
};

function getToneStyle(tone: SleepCoachTone) {
  switch (tone) {
    case 'prepare':
      return styles.cardPrepare;
    case 'actSoon':
      return styles.cardActSoon;
    case 'adjustDay':
      return styles.cardAdjustDay;
    case 'calm':
      return styles.cardCalm;
  }
}

export function SleepCoachCard({
  vm,
  onOpenWhy,
  onOpenAlternatives,
}: SleepCoachCardProps) {
  if (!vm.visible) {
    return null;
  }

  const whyAction = vm.hasWhyDetails ? onOpenWhy : undefined;
  const alternativesAction = vm.hasAlternatives ? onOpenAlternatives : undefined;
  const hasBadgeAction = typeof onOpenWhy === 'function';

  return (
    <View style={[styles.card, getToneStyle(vm.tone)]}>
      <View style={styles.accentLine} />
      <View style={styles.headerRow}>
        <Text style={styles.eyebrow}>{vm.eyebrow}</Text>
        {vm.badge ? (
          <Pressable
            accessibilityRole={hasBadgeAction ? 'button' : undefined}
            disabled={!hasBadgeAction}
            onPress={onOpenWhy}
            style={({ pressed }) => [
              styles.badge,
              pressed && hasBadgeAction ? styles.badgePressed : null,
            ]}>
            <Text numberOfLines={2} style={styles.badgeText}>
              {vm.badge}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.title}>{vm.title}</Text>
      <Text style={styles.body}>{vm.body}</Text>

      {vm.anchor ? (
        <View style={styles.anchor}>
          <Text style={styles.anchorText}>{vm.anchor}</Text>
        </View>
      ) : null}

      {whyAction || alternativesAction ? (
        <View style={styles.actions}>
          {whyAction ? (
            <Pressable
              accessibilityRole="button"
              onPress={whyAction}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed ? styles.secondaryButtonPressed : null,
              ]}>
              <Text style={styles.secondaryButtonText}>Почему так</Text>
            </Pressable>
          ) : null}
          {alternativesAction ? (
            <Pressable
              accessibilityRole="button"
              onPress={alternativesAction}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed ? styles.secondaryButtonPressed : null,
              ]}>
              <Text style={styles.secondaryButtonText}>Другие варианты</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingLeft: spacing.xl,
    backgroundColor: colors.primarySoft,
    gap: spacing.sm,
  },
  cardCalm: {
    borderColor: colors.primarySoft,
    backgroundColor: colors.primarySoft,
  },
  cardPrepare: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  cardActSoon: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  cardAdjustDay: {
    borderColor: colors.primarySoft,
    backgroundColor: colors.surface,
  },
  accentLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 5,
    backgroundColor: colors.primary,
  },
  headerRow: {
    minHeight: 30,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  eyebrow: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 140,
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  badge: {
    maxWidth: '100%',
    minHeight: 30,
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    backgroundColor: colors.surface,
  },
  badgePressed: {
    backgroundColor: colors.surfaceMuted,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 16,
  },
  title: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '900',
    lineHeight: 26,
  },
  body: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  anchor: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  anchorText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 19,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  secondaryButton: {
    minHeight: 44,
    maxWidth: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  secondaryButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '900',
  },
});
