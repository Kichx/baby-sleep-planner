import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheetSafeArea } from '@/components/BottomSheetSafeArea';
import { colors, radius, spacing } from '@/constants/theme';
import type { SleepCoachAlternativesSheetVm } from '@/core/mainScreenSleepCoach';

type SleepCoachAlternativesSheetProps = {
  visible: boolean;
  vm: SleepCoachAlternativesSheetVm;
  onClose: () => void;
};

export function SleepCoachAlternativesSheet({
  visible,
  vm,
  onClose,
}: SleepCoachAlternativesSheetProps) {
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
            <Text style={styles.title}>{vm.title}</Text>
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
              vm.items.map((item, index) => (
                <View
                  key={`${item.id}-${index}`}
                  style={[styles.item, item.isRecommended ? styles.itemRecommended : null]}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    {item.badge ? <Text style={styles.badge}>{item.badge}</Text> : null}
                  </View>
                  <Text style={styles.itemBody}>{item.body}</Text>
                  {item.anchor ? (
                    <View style={styles.anchor}>
                      <Text style={styles.anchorText}>{item.anchor}</Text>
                    </View>
                  ) : null}
                </View>
              ))
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
  title: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 27,
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
  item: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  itemRecommended: {
    borderColor: colors.primarySoft,
    backgroundColor: colors.primarySoft,
  },
  itemHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  itemTitle: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 140,
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 22,
  },
  badge: {
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
  itemBody: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  anchor: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  anchorText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 19,
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
