import { StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';

interface SleepPlanIconProps {
  backgroundColor?: string;
}

export function SleepPlanIcon({ backgroundColor = colors.primarySoft }: SleepPlanIconProps) {
  return (
    <View style={styles.icon}>
      <View style={styles.sheet}>
        <View style={styles.topLine} />
        <View style={styles.planRow}>
          <View style={styles.dot} />
          <View style={styles.shortLine} />
        </View>
        <View style={styles.planRow}>
          <View style={styles.dot} />
          <View style={styles.longLine} />
        </View>
        <View style={styles.planRow}>
          <View style={styles.dot} />
          <View style={styles.shortLine} />
        </View>
      </View>
      <View style={styles.moon}>
        <View style={[styles.moonCutout, { backgroundColor }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 24,
    height: 24,
  },
  sheet: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 17,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.6,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    paddingHorizontal: 3,
    paddingTop: 4,
    gap: 2.5,
  },
  topLine: {
    width: 8,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.primary,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  dot: {
    width: 2.5,
    height: 2.5,
    borderRadius: 1.25,
    backgroundColor: colors.warning,
  },
  shortLine: {
    width: 6,
    height: 1.8,
    borderRadius: 1,
    backgroundColor: colors.primarySoft,
  },
  longLine: {
    width: 8,
    height: 1.8,
    borderRadius: 1,
    backgroundColor: colors.primarySoft,
  },
  moon: {
    position: 'absolute',
    left: 0,
    top: 1,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: colors.warning,
  },
  moonCutout: {
    position: 'absolute',
    left: 5,
    top: -1,
    width: 11,
    height: 11,
    borderRadius: 5.5,
  },
});
