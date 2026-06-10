import { StyleSheet, View } from 'react-native';

import { colors, radius } from '@/constants/theme';

type BottleFeedingIconVariant = 'inline' | 'timeline';

type BottleFeedingIconProps = {
  active?: boolean;
  variant?: BottleFeedingIconVariant;
};

export function BottleFeedingIcon({
  active = false,
  variant = 'inline',
}: BottleFeedingIconProps) {
  const isTimelineVariant = variant === 'timeline';

  return (
    <View
      accessible={false}
      importantForAccessibility="no"
      style={[styles.icon, isTimelineVariant ? styles.timelineIcon : null]}>
      <View
        style={[
          styles.bottleCap,
          isTimelineVariant ? styles.timelineBottleCap : null,
          active ? styles.bottleActive : null,
        ]}
      />
      <View
        style={[
          styles.bottleBody,
          isTimelineVariant ? styles.timelineBottleBody : null,
          active ? styles.bottleActive : null,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 14,
    height: 14,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  bottleCap: {
    width: 6,
    height: 2,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
  },
  timelineBottleCap: {
    width: 7,
    height: 3,
  },
  bottleBody: {
    width: 9,
    height: 10,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
  },
  timelineBottleBody: {
    width: 12,
    height: 13,
    borderRadius: 5,
  },
  bottleActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
});
