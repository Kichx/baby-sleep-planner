import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';

interface SummaryCardProps {
  title: string;
  value: string;
  caption?: string;
  detail?: string;
  tone?: 'default' | 'accent' | 'warning';
}

export function SummaryCard({
  title,
  value,
  caption,
  detail,
  tone = 'default',
}: SummaryCardProps) {
  return (
    <View
      style={[
        styles.card,
        tone === 'accent' ? styles.accent : null,
        tone === 'warning' ? styles.warning : null,
      ]}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.valueBlock}>
        <Text style={styles.value}>{value}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 128,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
    justifyContent: 'space-between',
  },
  accent: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primarySoft,
  },
  warning: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningSoft,
  },
  title: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  value: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  valueBlock: {
    gap: spacing.xs,
  },
  detail: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  caption: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 18,
  },
});
