import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheetSafeArea } from '@/components/BottomSheetSafeArea';
import { colors, radius, spacing } from '@/constants/theme';
import type { SleepCoachWhySheetVm } from '@/core/mainScreenSleepCoach';

type SleepCoachWhySheetProps = {
  visible: boolean;
  vm: SleepCoachWhySheetVm;
  onClose: () => void;
};

export function SleepCoachWhySheet({ visible, vm, onClose }: SleepCoachWhySheetProps) {
  const isVisible = visible && vm.visible;

  return (
    <Modal
      animationType="slide"
      navigationBarTranslucent
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={isVisible}>
      <View style={styles.overlay}>
        <BottomSheetSafeArea style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>{vm.title}</Text>
              {vm.badge ? <Text style={styles.badge}>{vm.badge}</Text> : null}
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Закрыть</Text>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.scroll}
            contentContainerStyle={styles.content}>
            {vm.isFallback ? (
              <View style={styles.fallbackCard}>
                <Text style={styles.fallbackText}>{vm.summary}</Text>
              </View>
            ) : (
              <>
                {vm.sections.map((section) => (
                  <View key={section.title} style={styles.section}>
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                    <View style={styles.lines}>
                      {section.lines.map((line) => (
                        <Text key={line} style={styles.line}>
                          {line}
                        </Text>
                      ))}
                    </View>
                  </View>
                ))}

                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Итог</Text>
                  <Text style={styles.summaryText}>{vm.summary}</Text>
                </View>
              </>
            )}
          </ScrollView>
        </BottomSheetSafeArea>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(32, 32, 29, 0.36)',
  },
  sheet: {
    maxHeight: '88%',
    gap: spacing.md,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    backgroundColor: colors.background,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  header: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 27,
  },
  badge: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    overflow: 'hidden',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    color: colors.primary,
    backgroundColor: colors.surface,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 16,
  },
  closeButton: {
    minHeight: 38,
    justifyContent: 'center',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
  },
  closeButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  scroll: {
    flexShrink: 1,
  },
  content: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  section: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  lines: {
    gap: spacing.xs,
  },
  line: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  summaryCard: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    padding: spacing.md,
    backgroundColor: colors.primarySoft,
    gap: spacing.xs,
  },
  summaryLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  summaryText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
  fallbackCard: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  fallbackText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
});
