import { Image, StyleSheet } from 'react-native';

const sleepRetrospectiveIconSource = require('../../assets/images/sleep-retrospective-icon.png');

interface SleepRetrospectiveIconProps {
  size?: number;
}

export function SleepRetrospectiveIcon({ size = 28 }: SleepRetrospectiveIconProps) {
  return (
    <Image
      accessibilityIgnoresInvertColors
      accessible={false}
      resizeMode="contain"
      source={sleepRetrospectiveIconSource}
      style={[styles.icon, { width: size, height: size }]}
    />
  );
}

const styles = StyleSheet.create({
  icon: {
    overflow: 'hidden',
  },
});
