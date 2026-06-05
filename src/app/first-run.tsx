import { useState } from 'react';
import { Stack, type Href, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { DEFAULT_CHILD_NAME } from '@/constants/sleep';
import { colors, radius, spacing } from '@/constants/theme';
import { completeOnboardingTrackingOnly, updateChildProfile } from '@/db';

const HOME_ROUTE = '/' as Href;
const SLEEP_PLAN_ROUTE = {
  params: {
    source: 'first-run',
    returnTo: 'home',
  },
  pathname: '/sleep-plan',
} as const;

const EXAMPLES = [
  'Следующий сон: примерно в 10:20',
  'Бодрствует: 1 ч 25 мин',
  'Отбой: 19:30–20:00',
];

const HOW_IT_WORKS_STEPS = [
  {
    body: 'Например: подъём, количество дневных снов и примерный отбой.',
    title: 'Вы выбираете План дня',
  },
  {
    body: 'Показывает, сколько ребёнок уже не спит и когда может быть следующий сон.',
    title: 'Приложение считает текущее бодрствование',
  },
  {
    body: 'Если ночь была сложной или подъём ранний, приложение подскажет более мягкий сценарий на сегодня.',
    title: 'День можно вести гибко',
  },
] as const;

export default function FirstRunScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [isNamePromptVisible, setIsNamePromptVisible] = useState(false);
  const [isHowItWorksVisible, setIsHowItWorksVisible] = useState(false);
  const [childName, setChildName] = useState(DEFAULT_CHILD_NAME);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function openSleepPlan() {
    setIsHowItWorksVisible(false);
    router.push(SLEEP_PLAN_ROUTE);
  }

  function openNamePrompt() {
    if (isSaving) {
      return;
    }

    setErrorMessage(null);
    setIsNamePromptVisible(true);
  }

  function closeNamePrompt() {
    if (isSaving) {
      return;
    }

    setErrorMessage(null);
    setIsNamePromptVisible(false);
  }

  async function startTrackingOnly() {
    const trimmedName = childName.trim();

    if (trimmedName.length === 0) {
      setErrorMessage('Введите имя ребёнка');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await updateChildProfile(db, {
        birthDate: null,
        name: trimmedName,
      });
      await completeOnboardingTrackingOnly(db);
      router.replace(HOME_ROUTE);
    } catch {
      setErrorMessage('Не удалось сохранить стартовый выбор');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
          <View style={styles.content}>
            <View style={styles.headerBlock}>
              <Text style={styles.title}>План дня для сна малыша</Text>
              <Text style={styles.text}>
                Приложение помогает понять, сколько ребёнок бодрствует, когда ждать следующий
                сон и во сколько лучше уходить в ночь.
              </Text>
            </View>

            <View style={styles.exampleBlock}>
              {EXAMPLES.map((example) => (
                <View key={example} style={styles.exampleRow}>
                  <View style={styles.exampleDot} />
                  <Text style={styles.exampleText}>{example}</Text>
                </View>
              ))}
            </View>

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            <View style={styles.actions}>
              <PrimaryButton label="Выбрать План дня" onPress={openSleepPlan} />
              <PrimaryButton
                label="Пока просто записывать сны"
                onPress={openNamePrompt}
                variant="secondary"
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => setIsHowItWorksVisible(true)}
                style={({ pressed }) => [
                  styles.plainButton,
                  pressed ? styles.plainButtonPressed : null,
                ]}>
                <Text style={styles.plainButtonText}>Как это работает</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </ScrollView>

      <Modal
        animationType="slide"
        transparent
        visible={isNamePromptVisible}
        onRequestClose={closeNamePrompt}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={closeNamePrompt} />
          <View style={styles.bottomSheet}>
            <Text style={styles.sheetTitle}>Имя ребёнка</Text>
            <Text style={styles.sheetText}>Так записи сна будут понятнее. Изменить можно позже.</Text>
            {errorMessage ? <Text style={styles.sheetError}>{errorMessage}</Text> : null}
            <TextInput
              autoFocus
              editable={!isSaving}
              maxLength={32}
              onChangeText={(value) => {
                setChildName(value);
                setErrorMessage(null);
              }}
              placeholder="Имя"
              placeholderTextColor={colors.textMuted}
              returnKeyType="done"
              style={styles.nameInput}
              value={childName}
            />
            <View style={styles.sheetActions}>
              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                onPress={closeNamePrompt}
                style={({ pressed }) => [
                  styles.sheetSecondaryButton,
                  pressed && !isSaving ? styles.sheetButtonPressed : null,
                  isSaving ? styles.disabled : null,
                ]}>
                <Text style={styles.sheetSecondaryButtonText}>Отмена</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                onPress={() => {
                  void startTrackingOnly();
                }}
                style={({ pressed }) => [
                  styles.sheetPrimaryButton,
                  pressed && !isSaving ? styles.sheetPrimaryButtonPressed : null,
                  isSaving ? styles.disabled : null,
                ]}>
                <Text style={styles.sheetPrimaryButtonText}>
                  {isSaving ? 'Сохраняем...' : 'Начать записи'}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={isHowItWorksVisible}
        onRequestClose={() => setIsHowItWorksVisible(false)}>
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setIsHowItWorksVisible(false)}
          />
          <View style={styles.bottomSheet}>
            <Text style={styles.sheetTitle}>Как это работает</Text>
            <View style={styles.howList}>
              {HOW_IT_WORKS_STEPS.map((step, index) => (
                <View key={step.title} style={styles.howStep}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{index + 1}</Text>
                  </View>
                  <View style={styles.stepTextBlock}>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                    <Text style={styles.sheetText}>{step.body}</Text>
                  </View>
                </View>
              ))}
            </View>
            <View style={styles.howActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setIsHowItWorksVisible(false)}
                style={({ pressed }) => [
                  styles.sheetPrimaryButton,
                  styles.sheetFullWidthButton,
                  pressed ? styles.sheetPrimaryButtonPressed : null,
                ]}>
                <Text style={styles.sheetPrimaryButtonText}>Понятно</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={openSleepPlan}
                style={({ pressed }) => [
                  styles.sheetSecondaryButton,
                  styles.sheetFullWidthButton,
                  pressed ? styles.sheetButtonPressed : null,
                ]}>
                <Text style={styles.sheetSecondaryButtonText}>Выбрать План дня</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  content: {
    gap: spacing.xl,
  },
  headerBlock: {
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 40,
  },
  text: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
  },
  exampleBlock: {
    gap: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  exampleRow: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  exampleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  exampleText: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 23,
  },
  actions: {
    gap: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  plainButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  plainButtonPressed: {
    backgroundColor: colors.primarySoft,
  },
  plainButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(32, 32, 29, 0.36)',
  },
  bottomSheet: {
    gap: spacing.md,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: colors.surface,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 27,
  },
  sheetText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  sheetError: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '800',
  },
  nameInput: {
    minHeight: 54,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    color: colors.text,
    backgroundColor: colors.background,
    fontSize: 18,
    fontWeight: '800',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  howActions: {
    gap: spacing.sm,
  },
  sheetSecondaryButton: {
    minHeight: 50,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  sheetPrimaryButton: {
    minHeight: 50,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary,
  },
  sheetButtonPressed: {
    backgroundColor: colors.primarySoft,
  },
  sheetPrimaryButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  sheetFullWidthButton: {
    flex: undefined,
  },
  sheetSecondaryButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
  },
  sheetPrimaryButtonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.6,
  },
  howList: {
    gap: spacing.md,
  },
  howStep: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stepNumber: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
  },
  stepNumberText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 20,
  },
  stepTextBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  stepTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 22,
  },
});
