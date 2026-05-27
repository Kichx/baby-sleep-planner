import { Image, StyleSheet } from 'react-native';

const sleepPlanIconSource = require('../../assets/images/sleep-plan-icon.png');

interface SleepPlanIconProps {
  backgroundColor?: string;
  size?: number;
}

export function SleepPlanIcon({ size = 28 }: SleepPlanIconProps) {
  return (
    <Image
      accessibilityIgnoresInvertColors
      resizeMode="cover"
      source={sleepPlanIconSource}
      style={[styles.icon, { width: size, height: size, borderRadius: size / 2 }]}
    />
  );
}

const styles = StyleSheet.create({
  icon: {
    overflow: 'hidden',
  },
});
