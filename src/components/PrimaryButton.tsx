import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';

interface PrimaryButtonProps {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  compact?: boolean;
  variant?: 'primary' | 'secondary' | 'destructive';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  compact = false,
  variant = 'primary',
  style,
  textStyle,
}: PrimaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact ? styles.compactButton : null,
        variant === 'secondary' ? styles.secondaryButton : null,
        variant === 'destructive' ? styles.destructiveButton : null,
        pressed && !disabled && variant === 'primary' ? styles.primaryButtonPressed : null,
        pressed && !disabled && variant === 'secondary' ? styles.secondaryButtonPressed : null,
        pressed && !disabled && variant === 'destructive'
          ? styles.destructiveButtonPressed
          : null,
        disabled ? styles.buttonDisabled : null,
        style,
      ]}>
      <Text
        style={[
          styles.label,
          compact ? styles.compactLabel : null,
          variant === 'secondary' ? styles.secondaryLabel : null,
          variant === 'destructive' ? styles.destructiveLabel : null,
          textStyle,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 64,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.primary,
  },
  compactButton: {
    minHeight: 58,
    paddingHorizontal: spacing.md,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  destructiveButton: {
    backgroundColor: colors.danger,
  },
  primaryButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  secondaryButtonPressed: {
    backgroundColor: colors.primarySoft,
  },
  destructiveButtonPressed: {
    backgroundColor: colors.dangerPressed,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  label: {
    color: colors.surface,
    fontSize: 20,
    fontWeight: '700',
  },
  compactLabel: {
    fontSize: 17,
  },
  secondaryLabel: {
    color: colors.primary,
  },
  destructiveLabel: {
    color: colors.surface,
  },
});
