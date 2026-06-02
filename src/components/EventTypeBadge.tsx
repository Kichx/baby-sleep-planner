import { StyleSheet, View } from 'react-native';

import { colors, radius } from '@/constants/theme';

export type EventTypeBadgeKind = 'bottleFeeding' | 'napSleep' | 'nightSleep';

interface EventTypeBadgeProps {
  kind: EventTypeBadgeKind;
  quiet?: boolean;
}

export function EventTypeBadge({ kind, quiet = false }: EventTypeBadgeProps) {
  const isBottleFeeding = kind === 'bottleFeeding';
  const isNightSleep = kind === 'nightSleep';
  const backgroundColor = quiet
    ? colors.background
    : isNightSleep
      ? colors.warningSoft
      : colors.primarySoft;
  const iconColor = quiet ? colors.textMuted : isNightSleep ? colors.warning : colors.primary;

  return (
    <View
      accessible={false}
      importantForAccessibility="no"
      style={[styles.badge, quiet ? styles.quietBadge : null, { backgroundColor }]}>
      {isBottleFeeding ? <BottleIcon color={iconColor} /> : null}
      {kind === 'napSleep' ? <NapIcon color={iconColor} /> : null}
      {isNightSleep ? <MoonIcon backgroundColor={backgroundColor} color={iconColor} /> : null}
    </View>
  );
}

function BottleIcon({ color }: { color: string }) {
  return (
    <View style={styles.bottleIcon}>
      <View style={[styles.bottleCap, { backgroundColor: color }]} />
      <View style={[styles.bottleNeck, { borderColor: color }]} />
      <View style={[styles.bottleBody, { borderColor: color }]}>
        <View style={[styles.bottleLine, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

function NapIcon({ color }: { color: string }) {
  return (
    <View style={[styles.napIcon, { borderColor: color }]}>
      <View style={[styles.napPillowFold, { backgroundColor: color }]} />
    </View>
  );
}

function MoonIcon({ backgroundColor, color }: { backgroundColor: string; color: string }) {
  return (
    <View style={[styles.moonIcon, { backgroundColor: color }]}>
      <View style={[styles.moonCutout, { backgroundColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 32,
    height: 32,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  quietBadge: {
    width: 28,
    height: 28,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bottleIcon: {
    width: 14,
    height: 22,
    alignItems: 'center',
  },
  bottleCap: {
    width: 7,
    height: 3,
    borderRadius: 2,
  },
  bottleNeck: {
    width: 9,
    height: 4,
    borderLeftWidth: 2,
    borderRightWidth: 2,
  },
  bottleBody: {
    width: 13,
    height: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: 5,
  },
  bottleLine: {
    width: 5,
    height: 2,
    borderRadius: 1,
  },
  napIcon: {
    width: 17,
    height: 13,
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: 5,
  },
  napPillowFold: {
    width: 2,
    height: 7,
    marginLeft: 5,
    borderRadius: 1,
  },
  moonIcon: {
    width: 17,
    height: 17,
    borderRadius: 9,
  },
  moonCutout: {
    position: 'absolute',
    top: -1,
    right: -4,
    width: 15,
    height: 17,
    borderRadius: 9,
  },
});
