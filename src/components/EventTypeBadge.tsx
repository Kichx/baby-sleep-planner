import { Image, StyleSheet, View } from 'react-native';

import { colors, radius } from '@/constants/theme';

export type EventTypeBadgeKind = 'bottleFeeding' | 'napSleep' | 'nightSleep';

const BADGE_SIZE = 30;
const ICON_SIZE = 18;
const daySleepCrescentIconSource = require('../../assets/images/day-sleep-crescent.png');
const nightSleepCrescentIconSource = require('../../assets/images/night-sleep-crescent.png');

interface EventTypeBadgeProps {
  kind: EventTypeBadgeKind;
  quiet?: boolean;
}

export function EventTypeBadge({ kind, quiet = false }: EventTypeBadgeProps) {
  const isBottleFeeding = kind === 'bottleFeeding';
  const isNightSleep = kind === 'nightSleep';
  const backgroundColor = quiet
    ? colors.surface
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
      {isNightSleep ? <MoonIcon color={iconColor} /> : null}
    </View>
  );
}

function BottleIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconCanvas}>
      <View style={styles.bottleIcon}>
        <View style={[styles.bottleCap, { backgroundColor: color }]} />
        <View style={[styles.bottleNeck, { borderColor: color }]} />
        <View style={[styles.bottleBody, { borderColor: color }]}>
          <View style={[styles.bottleLine, { backgroundColor: color }]} />
        </View>
      </View>
    </View>
  );
}

function NapIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconCanvas}>
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={daySleepCrescentIconSource}
        style={[styles.imageIcon, { tintColor: color }]}
      />
    </View>
  );
}

function MoonIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconCanvas}>
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={nightSleepCrescentIconSource}
        style={[styles.imageIcon, { tintColor: color }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  quietBadge: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconCanvas: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottleIcon: {
    height: ICON_SIZE,
    alignItems: 'center',
  },
  bottleCap: {
    width: 6,
    height: 2,
    borderRadius: 2,
  },
  bottleNeck: {
    width: 8,
    height: 3,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
  },
  bottleBody: {
    width: 12,
    height: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: 5,
  },
  bottleLine: {
    width: 5,
    height: 2,
    borderRadius: 1,
  },
  imageIcon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
});
