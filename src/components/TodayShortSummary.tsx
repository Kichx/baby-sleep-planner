import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import type { TodayShortSummaryVm } from '@/core/todayShortSummary';

type TodayShortSummaryProps = {
  vm: TodayShortSummaryVm;
  onOpenDetails?: () => void;
};

export function TodayShortSummary({ vm, onOpenDetails }: TodayShortSummaryProps) {
  if (!vm.visible) {
    return null;
  }

  const canOpenDetails = vm.hasDetails && typeof onOpenDetails === 'function';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{vm.title}</Text>
        {canOpenDetails ? (
          <Pressable
            accessibilityRole="button"
            onPress={onOpenDetails}
            style={({ pressed }) => [
              styles.detailsButton,
              pressed ? styles.detailsButtonPressed : null,
            ]}>
            <Text style={styles.detailsButtonText}>{vm.detailsLabel}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.rows}>
        {vm.rows.map((row) => (
          <Text
            key={row.id}
            numberOfLines={2}
            style={[styles.rowText, row.tone === 'secondary' ? styles.secondaryRowText : null]}>
            {row.text}
          </Text>
        ))}
      </View>
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
  detailsButton: {
    minHeight: 34,
    flexShrink: 0,
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
  },
  detailsButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  detailsButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  rows: {
    gap: spacing.xs,
  },
  rowText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  secondaryRowText: {
    color: colors.textMuted,
    fontWeight: '700',
  },
});
