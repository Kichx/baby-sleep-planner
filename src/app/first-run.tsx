import { useState } from 'react';
import { Stack, type Href, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  Image,
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

import { BottomSheetSafeArea } from '@/components/BottomSheetSafeArea';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, radius, spacing } from '@/constants/theme';
import {
  CHILD_NAME_INPUT_PLACEHOLDER,
  CHILD_NAME_MAX_LENGTH,
  getChildNameValidationError,
  normalizeChildName,
} from '@/core/childProfile';
import { completeOnboardingTrackingOnly, updateChildProfileName } from '@/db';

const HOME_ROUTE = '/' as Href;
const SLEEP_PLAN_ROUTE = '/sleep-plan?source=first-run&returnTo=home' as Href;
const appIconSource = require('../../assets/images/icon.png');

const EXAMPLES = [
  'Следующий сон: примерно в 10:20',
  'Бодрствует: 1 ч 25 мин',
  'Отбой: 19:30–20:00',
];

const HOW_IT_WORKS_STEPS = [
  {
    body: 'Можно собрать его самому или выбрать готовый вариант по возрасту: подъём, дневные сны и примерный отбой.',
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
  const [childName, setChildName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function openSleepPlan() {
    setIsHowItWorksVisible(false);
    router.replace(SLEEP_PLAN_ROUTE);
  }

  function openNamePrompt() {
    if (isSaving) {
      return;
    }

    setErrorMessage(null);
    setChildName('');
    setIsNamePromptVisible(true);
  }

  function closeNamePrompt() {
    if (isSaving) {
      return;
    }

    setErrorMessage(null);
    setIsNamePromptVisible(false);
  }

  async function startTrackingOnly(options: { saveName: boolean }) {
    if (isSaving) {
      return;
    }

    const validationError = options.saveName
      ? getChildNameValidationError(childName, { required: false })
      : null;

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    const trimmedName = normalizeChildName(childName);

    setIsSaving(true);
    setErrorMessage(null);

    try {
      if (options.saveName && trimmedName.length > 0) {
        await updateChildProfileName(db, trimmedName);
      }

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
            <Image
              accessibilityIgnoresInvertColors
              accessibilityLabel="Иконка приложения Режимка"
              source={appIconSource}
              style={styles.appIcon}
            />

            <View style={styles.headerBlock}>
              <View style={styles.titleBlock}>
                <Text style={styles.title}>Режимка</Text>
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.86}
                  numberOfLines={1}
                  style={styles.titleSlogan}>
                  меньше считать, больше спать
                </Text>
              </View>
              <Text style={styles.text}>
                Приложение помогает понять, сколько ребёнок бодрствует, когда ждать следующий
                сон и во сколько лучше уходить в ночь.
              </Text>
            </View>

            <View style={styles.exampleBlock}>
              <Text style={styles.exampleLabel}>Пример подсказки</Text>
              {EXAMPLES.map((example) => (
                <View key={example} style={styles.exampleRow}>
                  <View style={styles.exampleDot} />
                  <Text style={styles.exampleText}>{example}</Text>
                </View>
              ))}
            </View>

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            <View style={styles.actions}>
              <PrimaryButton
                compact
                label="Выбрать План дня"
                onPress={openSleepPlan}
                textStyle={styles.actionButtonText}
              />
              <PrimaryButton
                compact
                label="Пока просто записывать сны"
                onPress={openNamePrompt}
                textStyle={styles.actionButtonText}
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
          <BottomSheetSafeArea style={styles.bottomSheet}>
            <Text style={styles.sheetTitle}>Как зовут ребёнка?</Text>
            {errorMessage ? <Text style={styles.sheetError}>{errorMessage}</Text> : null}
            <TextInput
              accessibilityLabel="Имя ребёнка"
              autoCapitalize="words"
              autoFocus
              editable={!isSaving}
              maxLength={CHILD_NAME_MAX_LENGTH}
              onChangeText={(value) => {
                setChildName(value);
                setErrorMessage(null);
              }}
              placeholder={CHILD_NAME_INPUT_PLACEHOLDER}
              placeholderTextColor={colors.textMuted}
              returnKeyType="done"
              style={styles.nameInput}
              value={childName}
            />
            <View style={styles.sheetActions}>
              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                onPress={() => {
                  void startTrackingOnly({ saveName: false });
                }}
                style={({ pressed }) => [
                  styles.sheetSecondaryButton,
                  pressed && !isSaving ? styles.sheetButtonPressed : null,
                  isSaving ? styles.disabled : null,
                ]}>
                <Text style={styles.sheetSecondaryButtonText}>Пропустить</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                onPress={() => {
                  void startTrackingOnly({ saveName: true });
                }}
                style={({ pressed }) => [
                  styles.sheetPrimaryButton,
                  pressed && !isSaving ? styles.sheetPrimaryButtonPressed : null,
                  isSaving ? styles.disabled : null,
                ]}>
                <Text style={styles.sheetPrimaryButtonText}>
                  {isSaving ? 'Сохраняем...' : 'Продолжить'}
                </Text>
              </Pressable>
            </View>
          </BottomSheetSafeArea>
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
          <BottomSheetSafeArea style={styles.bottomSheet}>
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
          </BottomSheetSafeArea>
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
    gap: spacing.lg,
  },
  appIcon: {
    width: 76,
    height: 76,
    alignSelf: 'center',
    borderRadius: 18,
  },
  headerBlock: {
    gap: spacing.sm,
  },
  titleBlock: {
    alignItems: 'center',
    gap: 2,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 31,
    textAlign: 'center',
  },
  titleSlogan: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
    textAlign: 'center',
  },
  text: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
  },
  exampleBlock: {
    gap: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    backgroundColor: colors.surface,
  },
  exampleLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  exampleRow: {
    minHeight: 30,
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
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  actions: {
    gap: spacing.sm,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  plainButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  plainButtonPressed: {
    backgroundColor: colors.primarySoft,
  },
  plainButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
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
    gap: spacing.sm,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: colors.surface,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 23,
  },
  sheetText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
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
    fontSize: 15,
    fontWeight: '700',
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
    fontSize: 14,
    fontWeight: '800',
  },
  sheetPrimaryButtonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.6,
  },
  howList: {
    gap: spacing.sm,
  },
  howStep: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stepNumber: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
  },
  stepNumberText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 19,
  },
  stepTextBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  stepTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
});
