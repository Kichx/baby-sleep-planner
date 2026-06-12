import { useEffect, useMemo, useState } from 'react';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Stack, type Href, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useSQLiteContext } from 'expo-sqlite';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { buildApplicationVersionLine } from '@/appVersion';
import { BottomSheetSafeArea } from '@/components/BottomSheetSafeArea';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { SleepPlanIcon } from '@/components/SleepPlanIcon';
import { DEFAULT_CHILD_NAME } from '@/constants/sleep';
import { colors, radius, spacing } from '@/constants/theme';
import {
  CHILD_NAME_MAX_LENGTH,
  getChildNameValidationError,
  normalizeChildName,
} from '@/core/childProfile';
import {
  APP_DATA_BACKUP_MIME_TYPE,
  DataTransferError,
  applyBottleFeedingPromptDecision,
  buildAppDataBackup,
  deleteProfilePhotoCopy,
  getChildProfile,
  parseAppDataBackup,
  resetApplicationData,
  restoreAppDataBackup,
  saveProfilePhotoCopy,
  serializeAppDataBackup,
  updateChildBottleFeedingEnabled,
  updateChildProfile,
  updateChildProfilePhotoUri,
} from '@/db';
import {
  cancelAllLocalSleepNotifications,
  syncSleepNotificationsFromDatabase,
} from '@/notifications/sleepNotifications';

const SLEEP_PLAN_ROUTE = '/sleep-plan' as Href;
const INFO_ROUTE = '/info' as Href;
const FIRST_RUN_ROUTE = '/first-run' as Href;

type ResetConfirmationStep = 'hidden' | 'first' | 'second';

function formatBirthDate(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function toBirthDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function parseBirthDateValue(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const [rawYear, rawMonth, rawDay] = value.split('-');
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const day = Number(rawDay);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function startOfCalendarDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function formatBackupFileName(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `rezhimka-backup-${year}-${month}-${day}-${hours}${minutes}.json`;
}

function getTransferErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof DataTransferError) {
    if (error.code === 'invalid-data') {
      return 'В файле не хватает данных или они повреждены';
    }

    return 'Выберите файл экспорта из Режимки';
  }

  return fallback;
}

function formatRestoreMessage(summary: {
  bottleFeedings: number;
  childProfiles: number;
  sleepDayPlanSnapshots: number;
  sleepSessions: number;
  targetDayPlans: number;
}): string {
  return [
    `Профилей: ${summary.childProfiles}`,
    `Записей сна: ${summary.sleepSessions}`,
    `Кормлений бутылочкой: ${summary.bottleFeedings}`,
    `Планов сна: ${summary.targetDayPlans}`,
    `Привязок дней: ${summary.sleepDayPlanSnapshots}`,
  ].join('\n');
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function addCalendarMonths(date: Date, months: number): Date {
  const targetYear = date.getFullYear();
  const targetMonth = date.getMonth() + months;
  const normalizedDate = new Date(targetYear, targetMonth, 1, 0, 0, 0, 0);
  const daysInTargetMonth = getDaysInMonth(
    normalizedDate.getFullYear(),
    normalizedDate.getMonth(),
  );

  normalizedDate.setDate(Math.min(date.getDate(), daysInTargetMonth));

  return normalizedDate;
}

function formatAgeFromBirthDate(birthDate: Date, now: Date): string {
  const today = startOfCalendarDay(now);
  const birthday = startOfCalendarDay(birthDate);

  if (birthday.getTime() > today.getTime()) {
    return 'Дата в будущем';
  }

  let months =
    (today.getFullYear() - birthday.getFullYear()) * 12 +
    today.getMonth() -
    birthday.getMonth();
  let monthAnchor = addCalendarMonths(birthday, months);

  if (monthAnchor.getTime() > today.getTime()) {
    months -= 1;
    monthAnchor = addCalendarMonths(birthday, months);
  }

  const restDays = Math.floor((today.getTime() - monthAnchor.getTime()) / 86_400_000);
  const weeks = Math.floor(restDays / 7);

  return `${months} мес ${weeks} нед`;
}

interface InfoRowProps {
  label: string;
  value: string;
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function InfoIcon() {
  return (
    <View style={styles.infoIcon}>
      <View style={styles.infoIconDot} />
      <View style={styles.infoIconLine} />
    </View>
  );
}

export default function ProfileScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [profileName, setProfileName] = useState(DEFAULT_CHILD_NAME);
  const [birthDate, setBirthDate] = useState<string | null>(null);
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);
  const [draftName, setDraftName] = useState(DEFAULT_CHILD_NAME);
  const [draftBirthDate, setDraftBirthDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFeatureSaving, setIsFeatureSaving] = useState(false);
  const [isPhotoSaving, setIsPhotoSaving] = useState(false);
  const [isDataTransferRunning, setIsDataTransferRunning] = useState(false);
  const [resetConfirmationStep, setResetConfirmationStep] =
    useState<ResetConfirmationStep>('hidden');
  const [isResetting, setIsResetting] = useState(false);
  const [bottleFeedingEnabled, setBottleFeedingEnabled] = useState(false);
  const [bottleFeedingPromptDismissed, setBottleFeedingPromptDismissed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const trimmedDraftName = normalizeChildName(draftName);
  const draftBirthDateValue = useMemo(() => parseBirthDateValue(draftBirthDate), [draftBirthDate]);
  const birthDateLabel = draftBirthDateValue ? formatBirthDate(draftBirthDateValue) : 'Выбрать';
  const ageLabel = draftBirthDateValue
    ? `Возраст: ${formatAgeFromBirthDate(draftBirthDateValue, new Date())}`
    : 'Возраст: не указан';
  const profileNameError = getChildNameValidationError(draftName, { required: true });
  const hasProfileChanges =
    profileNameError === null &&
    (trimmedDraftName !== profileName || draftBirthDate !== birthDate);
  const isBusy =
    isLoading || isSaving || isPhotoSaving || isDataTransferRunning || isResetting;
  const isToggleDisabled = isBusy || isFeatureSaving;
  const versionLine = buildApplicationVersionLine();

  function applyProfile(profile: {
    bottleFeedingEnabled: boolean;
    bottleFeedingPromptDismissed: boolean;
    name: string;
    birthDate: string | null;
    photoUri: string | null;
  }) {
    setBottleFeedingEnabled(profile.bottleFeedingEnabled);
    setBottleFeedingPromptDismissed(profile.bottleFeedingPromptDismissed);
    setProfileName(profile.name);
    setBirthDate(profile.birthDate);
    setProfilePhotoUri(profile.photoUri);
    setDraftName(profile.name);
    setDraftBirthDate(profile.birthDate);
  }

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      setIsLoading(true);

      try {
        const profile = await getChildProfile(db);

        if (isMounted) {
          applyProfile(profile);
          setErrorMessage(null);
        }
      } catch {
        if (isMounted) {
          setErrorMessage('Не удалось загрузить профиль');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [db]);

  function openBirthDatePicker() {
    if (Platform.OS !== 'android') {
      return;
    }

    DateTimePickerAndroid.open({
      display: 'calendar',
      maximumDate: new Date(),
      mode: 'date',
      negativeButton: {
        label: 'Отмена',
      },
      onDismiss: () => {},
      onValueChange: (_event, selectedDate) => {
        if (!selectedDate) {
          return;
        }

        setDraftBirthDate(toBirthDateValue(selectedDate));
        setMessage(null);
        setErrorMessage(null);
      },
      positiveButton: {
        label: 'Готово',
      },
      value: draftBirthDateValue ?? new Date(),
    });
  }

  async function handleSaveProfile() {
    if (profileNameError) {
      setErrorMessage(profileNameError);
      setMessage(null);
      return;
    }

    if (draftBirthDate && !draftBirthDateValue) {
      setErrorMessage('Проверьте дату рождения');
      setMessage(null);
      return;
    }

    if (
      draftBirthDateValue &&
      draftBirthDateValue.getTime() > startOfCalendarDay(new Date()).getTime()
    ) {
      setErrorMessage('Дата рождения не может быть в будущем');
      setMessage(null);
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setMessage(null);

    try {
      await updateChildProfile(db, {
        birthDate: draftBirthDate,
        name: trimmedDraftName,
      });
      setProfileName(trimmedDraftName);
      setBirthDate(draftBirthDate);
      setDraftName(trimmedDraftName);
      setMessage('Сохранено');
    } catch {
      setErrorMessage('Не удалось сохранить профиль');
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePickProfilePhoto() {
    setIsPhotoSaving(true);
    setMessage(null);
    setErrorMessage(null);

    let copiedPhotoUri: string | null = null;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        mediaTypes: ['images'],
        quality: 0.9,
        shape: 'oval',
      });

      if (result.canceled) {
        return;
      }

      const selectedAsset = result.assets[0];

      copiedPhotoUri = await saveProfilePhotoCopy({
        fileName: selectedAsset.fileName,
        mimeType: selectedAsset.mimeType,
        sourceUri: selectedAsset.uri,
      });

      await updateChildProfilePhotoUri(db, copiedPhotoUri);

      const previousPhotoUri = profilePhotoUri;

      setProfilePhotoUri(copiedPhotoUri);
      deleteProfilePhotoCopy(previousPhotoUri);
      setMessage('Фото обновлено');
    } catch {
      deleteProfilePhotoCopy(copiedPhotoUri);
      setErrorMessage('Не удалось сохранить фото');
    } finally {
      setIsPhotoSaving(false);
    }
  }

  async function handleRemoveProfilePhoto() {
    if (!profilePhotoUri) {
      return;
    }

    const previousPhotoUri = profilePhotoUri;

    setIsPhotoSaving(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      await updateChildProfilePhotoUri(db, null);
      setProfilePhotoUri(null);
      deleteProfilePhotoCopy(previousPhotoUri);
      setMessage('Фото убрано');
    } catch {
      setErrorMessage('Не удалось убрать фото');
    } finally {
      setIsPhotoSaving(false);
    }
  }

  async function handleBottleFeedingEnabledChange(enabled: boolean) {
    const previousValue = bottleFeedingEnabled;

    setBottleFeedingEnabled(enabled);
    setIsFeatureSaving(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      await updateChildBottleFeedingEnabled(db, enabled);
      await syncSleepNotificationsFromDatabase(db);
      setMessage('Настройка сохранена');
    } catch {
      setBottleFeedingEnabled(previousValue);
      setErrorMessage('Не удалось сохранить настройку');
    } finally {
      setIsFeatureSaving(false);
    }
  }

  async function handleBottleFeedingPromptDecision(enabled: boolean) {
    const previousEnabled = bottleFeedingEnabled;
    const previousDismissed = bottleFeedingPromptDismissed;

    setBottleFeedingEnabled(enabled);
    setBottleFeedingPromptDismissed(true);
    setIsFeatureSaving(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      await applyBottleFeedingPromptDecision(db, enabled);
      await syncSleepNotificationsFromDatabase(db);
      setMessage(enabled ? 'Кормление бутылочкой включено' : 'Настройка сохранена');
    } catch {
      setBottleFeedingEnabled(previousEnabled);
      setBottleFeedingPromptDismissed(previousDismissed);
      setErrorMessage('Не удалось сохранить настройку');
    } finally {
      setIsFeatureSaving(false);
    }
  }

  async function handleExportData(): Promise<boolean> {
    setIsDataTransferRunning(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const backup = await buildAppDataBackup(db);
      const backupFile = new File(Paths.cache, formatBackupFileName(new Date()));
      backupFile.create({ overwrite: true });
      backupFile.write(serializeAppDataBackup(backup));

      const isSharingAvailable = await Sharing.isAvailableAsync();

      if (!isSharingAvailable) {
        throw new Error('Sharing is unavailable');
      }

      await Sharing.shareAsync(backupFile.uri, {
        UTI: 'public.json',
        dialogTitle: 'Выгрузить данные',
        mimeType: APP_DATA_BACKUP_MIME_TYPE,
      });
      setMessage('Файл экспорта подготовлен');
      return true;
    } catch (error) {
      setErrorMessage(getTransferErrorMessage(error, 'Не удалось выгрузить данные'));
      return false;
    } finally {
      setIsDataTransferRunning(false);
    }
  }

  async function pickAndRestoreData() {
    setIsDataTransferRunning(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: '*/*',
      });

      if (result.canceled) {
        return;
      }

      const selectedFile = new File(result.assets[0].uri);
      const backup = parseAppDataBackup(await selectedFile.text());
      const summary = await restoreAppDataBackup(db, backup);
      const restoredProfile = await getChildProfile(db);
      const restoreMessage = formatRestoreMessage(summary);

      applyProfile(restoredProfile);
      await syncSleepNotificationsFromDatabase(db);
      setMessage(restoreMessage);
      Alert.alert('Данные восстановлены', restoreMessage);
    } catch (error) {
      const restoreErrorMessage = getTransferErrorMessage(
        error,
        'Не удалось восстановить данные',
      );

      setErrorMessage(restoreErrorMessage);
      Alert.alert('Не удалось восстановить данные', restoreErrorMessage);
    } finally {
      setIsDataTransferRunning(false);
    }
  }

  function confirmRestoreData() {
    Alert.alert(
      'Восстановить данные?',
      'Текущие записи сна и планы будут заменены данными из файла.',
      [
        {
          style: 'cancel',
          text: 'Отмена',
        },
        {
          onPress: () => {
            void pickAndRestoreData();
          },
          style: 'destructive',
          text: 'Выбрать файл',
        },
      ],
    );
  }

  function confirmRemoveProfilePhoto() {
    Alert.alert('Убрать фото?', 'Кнопка профиля снова будет показывать первую букву имени.', [
      {
        style: 'cancel',
        text: 'Отмена',
      },
      {
        onPress: () => {
          void handleRemoveProfilePhoto();
        },
        style: 'destructive',
        text: 'Убрать',
      },
    ]);
  }

  function openSleepPlan() {
    router.push(SLEEP_PLAN_ROUTE);
  }

  function openInfo() {
    router.push(INFO_ROUTE);
  }

  function openResetConfirmation() {
    if (isBusy) {
      return;
    }

    setMessage(null);
    setErrorMessage(null);
    setResetConfirmationStep('first');
  }

  function closeResetConfirmation() {
    if (isResetting) {
      return;
    }

    setResetConfirmationStep('hidden');
  }

  function continueResetConfirmation() {
    setResetConfirmationStep('second');
  }

  async function handleBackupBeforeReset() {
    await handleExportData();
    setResetConfirmationStep('second');
  }

  async function handleResetApplication() {
    if (isResetting) {
      return;
    }

    const previousPhotoUri = profilePhotoUri;

    setIsResetting(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      await resetApplicationData(db);
      await cancelAllLocalSleepNotifications();
      deleteProfilePhotoCopy(previousPhotoUri);
      applyProfile({
        birthDate: null,
        bottleFeedingEnabled: false,
        bottleFeedingPromptDismissed: false,
        name: DEFAULT_CHILD_NAME,
        photoUri: null,
      });
      setResetConfirmationStep('hidden');
      router.replace(FIRST_RUN_ROUTE);
    } catch (error) {
      console.error(error);
      setErrorMessage('Не удалось сбросить данные. Попробуйте ещё раз.');
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Профиль' }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoider}>
        <ScrollView
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          style={styles.screen}
          contentContainerStyle={styles.scrollContent}>
          <SafeAreaView edges={['bottom']} style={styles.safeArea}>
            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
            {message ? <Text style={styles.successText}>{message}</Text> : null}

            <View style={styles.profileHeader}>
              <Pressable
                accessibilityLabel="Сменить фото ребёнка"
                accessibilityRole="button"
                disabled={isBusy}
                onPress={handlePickProfilePhoto}
                style={({ pressed }) => [
                  styles.avatarButton,
                  pressed && !isBusy ? styles.avatarButtonPressed : null,
                ]}>
                <ProfileAvatar
                  name={profileName}
                  photoUri={profilePhotoUri}
                  size={62}
                  tone="solid"
                />
              </Pressable>
              <View style={styles.profileTitleBlock}>
                <Text style={styles.profileTitle}>{profileName}</Text>
                <Text style={styles.profileSubtitle}>Профиль ребёнка</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ребёнок</Text>
              <TextInput
                accessibilityLabel="Имя ребёнка"
                autoCapitalize="words"
                editable={!isBusy}
                maxLength={CHILD_NAME_MAX_LENGTH}
                onChangeText={(value) => {
                  setDraftName(value);
                  setMessage(null);
                  setErrorMessage(null);
                }}
                placeholder="Имя ребёнка"
                placeholderTextColor={colors.textMuted}
                returnKeyType="done"
                style={styles.nameInput}
                value={draftName}
              />
              <Pressable
                accessibilityLabel="Дата рождения ребёнка"
                accessibilityRole="button"
                disabled={isBusy}
                onPress={openBirthDatePicker}
                style={({ pressed }) => [
                  styles.birthDateField,
                  pressed && !isBusy ? styles.birthDateFieldPressed : null,
                ]}>
                <View style={styles.birthDateTextBlock}>
                  <Text style={styles.compactLabel}>Дата рождения ребёнка</Text>
                  <Text
                    adjustsFontSizeToFit
                    minimumFontScale={0.84}
                    numberOfLines={1}
                    style={styles.birthDateValue}>
                    {birthDateLabel}
                  </Text>
                </View>
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                  numberOfLines={1}
                  style={styles.ageText}>
                  {ageLabel}
                </Text>
              </Pressable>
              <View style={styles.photoActionRow}>
                <PrimaryButton
                  compact
                  disabled={isBusy}
                  label={
                    isPhotoSaving
                      ? 'Сохраняем...'
                      : profilePhotoUri
                        ? 'Сменить фото'
                        : 'Добавить фото'
                  }
                  onPress={handlePickProfilePhoto}
                  style={styles.photoActionButton}
                  textStyle={styles.photoActionText}
                  variant="secondary"
                />
                {profilePhotoUri ? (
                  <PrimaryButton
                    compact
                    disabled={isBusy}
                    label="Убрать"
                    onPress={confirmRemoveProfilePhoto}
                    style={styles.photoRemoveButton}
                    textStyle={styles.photoActionText}
                    variant="secondary"
                  />
                ) : null}
              </View>
              <PrimaryButton
                compact
                disabled={isBusy || !hasProfileChanges}
                label={isSaving ? 'Сохраняем...' : 'Сохранить'}
                onPress={handleSaveProfile}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>План сна</Text>
              <Pressable
                accessibilityLabel="Открыть план сна"
                accessibilityRole="button"
                onPress={openSleepPlan}
                style={({ pressed }) => [styles.planLink, pressed ? styles.planLinkPressed : null]}>
                <View style={styles.planLinkIcon}>
                  <SleepPlanIcon backgroundColor={colors.primarySoft} />
                </View>
                <View style={styles.planLinkTextBlock}>
                  <Text style={styles.planLinkTitle}>Открыть план сна</Text>
                  <Text style={styles.planLinkSubtitle}>График и прогноз отбоя</Text>
                </View>
                <Text style={styles.planLinkArrow}>{'>'}</Text>
              </Pressable>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Дополнительно</Text>
              {!bottleFeedingEnabled && !bottleFeedingPromptDismissed ? (
                <View style={styles.featurePrompt}>
                  <View style={styles.featureToggleTextBlock}>
                    <Text style={styles.featurePromptTitle}>
                      Хотите отслеживать кормление бутылочкой?
                    </Text>
                    <Text style={styles.featureToggleDescription}>
                      Записывайте время и объём кормления, чтобы видеть, сколько прошло с последнего раза.
                    </Text>
                  </View>
                  <View style={styles.featurePromptActions}>
                    <PrimaryButton
                      compact
                      disabled={isToggleDisabled}
                      label="Включить"
                      onPress={() => {
                        void handleBottleFeedingPromptDecision(true);
                      }}
                      style={styles.featurePromptButton}
                      textStyle={styles.featurePromptButtonText}
                    />
                    <PrimaryButton
                      compact
                      disabled={isToggleDisabled}
                      label="Не сейчас"
                      onPress={() => {
                        void handleBottleFeedingPromptDecision(false);
                      }}
                      style={styles.featurePromptButton}
                      textStyle={styles.featurePromptButtonText}
                      variant="secondary"
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.featureToggleRow}>
                  <View style={styles.featureToggleTextBlock}>
                    <Text style={styles.featureToggleTitle}>Кормление бутылочкой</Text>
                    <Text style={styles.featureToggleDescription}>
                      Записывайте время и объём кормления, чтобы видеть, сколько прошло с последнего раза.
                    </Text>
                  </View>
                  <Switch
                    accessibilityLabel="Кормление бутылочкой"
                    disabled={isToggleDisabled}
                    onValueChange={handleBottleFeedingEnabledChange}
                    thumbColor={bottleFeedingEnabled ? colors.primary : colors.surface}
                    trackColor={{
                      false: colors.surfaceMuted,
                      true: colors.primarySoft,
                    }}
                    value={bottleFeedingEnabled}
                  />
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Данные</Text>
              <View style={styles.infoList}>
                <InfoRow label="Хранение" value="На устройстве" />
                <InfoRow label="Аккаунт" value="Не нужен" />
                <InfoRow label="Облако" value="Не используется" />
              </View>
              <View style={styles.transferBlock}>
                <View style={styles.transferTextBlock}>
                  <Text style={styles.transferTitle}>Перенос данных</Text>
                  <Text style={styles.transferText}>Профиль, планы и записи сна</Text>
                </View>
                <View style={styles.transferActions}>
                  <PrimaryButton
                    compact
                    disabled={isBusy}
                    label={isDataTransferRunning ? 'Готовим...' : 'Выгрузить'}
                    onPress={() => {
                      void handleExportData();
                    }}
                  />
                  <PrimaryButton
                    compact
                    disabled={isBusy}
                    label="Восстановить"
                    onPress={confirmRestoreData}
                    variant="secondary"
                  />
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>О приложении</Text>
              <View style={styles.aboutBlock}>
                <Text style={styles.aboutTitle}>Планировщик сна</Text>
                <Text style={styles.aboutText}>{versionLine}</Text>
              </View>
              <Pressable
                accessibilityLabel="Открыть справку"
                accessibilityRole="button"
                onPress={openInfo}
                style={({ pressed }) => [styles.planLink, pressed ? styles.planLinkPressed : null]}>
                <View style={styles.planLinkIcon}>
                  <InfoIcon />
                </View>
                <View style={styles.planLinkTextBlock}>
                  <Text style={styles.planLinkTitle}>Справка</Text>
                  <Text style={styles.planLinkSubtitle}>Информация о работе приложения</Text>
                </View>
                <Text style={styles.planLinkArrow}>{'>'}</Text>
              </Pressable>
            </View>

            <View style={styles.dangerSection}>
              <Text style={styles.dangerSectionTitle}>Опасная зона</Text>
              <View style={styles.dangerBlock}>
                <View style={styles.transferTextBlock}>
                  <Text style={styles.dangerTitle}>Полный сброс приложения</Text>
                  <Text style={styles.dangerText}>
                    Удалит профиль, записи сна, План дня, кормления и локальные настройки.
                  </Text>
                </View>
                <PrimaryButton
                  compact
                  disabled={isBusy}
                  label="Сбросить приложение"
                  onPress={openResetConfirmation}
                  variant="destructive"
                />
              </View>
            </View>
          </SafeAreaView>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        animationType="slide"
        transparent
        visible={resetConfirmationStep !== 'hidden'}
        onRequestClose={closeResetConfirmation}>
        <View style={styles.modalRoot}>
          <Pressable
            disabled={isResetting}
            style={styles.modalBackdrop}
            onPress={closeResetConfirmation}
          />
          <BottomSheetSafeArea style={styles.bottomSheet}>
            {resetConfirmationStep === 'first' ? (
              <>
                <Text style={styles.sheetTitle}>Сбросить приложение?</Text>
                <Text style={styles.sheetText}>
                  Будут удалены все записи сна, План дня, профиль ребёнка, кормления,
                  временные режимы и локальные настройки. Это действие нельзя отменить.
                </Text>
                {errorMessage ? <Text style={styles.sheetError}>{errorMessage}</Text> : null}
                <View style={styles.sheetActions}>
                  <PrimaryButton
                    compact
                    disabled={isResetting}
                    label="Продолжить"
                    onPress={continueResetConfirmation}
                    style={styles.sheetActionButton}
                    textStyle={styles.sheetActionButtonText}
                    variant="destructive"
                  />
                  <PrimaryButton
                    compact
                    disabled={isResetting}
                    label="Отмена"
                    onPress={closeResetConfirmation}
                    style={styles.sheetActionButton}
                    textStyle={styles.sheetActionButtonText}
                    variant="secondary"
                  />
                </View>
              </>
            ) : (
              <>
                <Text style={styles.sheetTitle}>Удалить все данные?</Text>
                <Text style={styles.sheetText}>
                  Приложение вернётся к первому запуску. Перед сбросом можно сделать
                  резервную копию.
                </Text>
                {errorMessage ? <Text style={styles.sheetError}>{errorMessage}</Text> : null}
                <View style={styles.sheetActionsVertical}>
                  <PrimaryButton
                    compact
                    disabled={isDataTransferRunning || isResetting}
                    label={
                      isDataTransferRunning ? 'Готовим копию...' : 'Сделать резервную копию'
                    }
                    onPress={() => {
                      void handleBackupBeforeReset();
                    }}
                    style={styles.sheetFullWidthButton}
                    textStyle={styles.sheetActionButtonText}
                    variant="secondary"
                  />
                  <PrimaryButton
                    compact
                    disabled={isDataTransferRunning || isResetting}
                    label={isResetting ? 'Удаляем...' : 'Удалить всё'}
                    onPress={() => {
                      void handleResetApplication();
                    }}
                    style={styles.sheetFullWidthButton}
                    textStyle={styles.sheetActionButtonText}
                    variant="destructive"
                  />
                  <PrimaryButton
                    compact
                    disabled={isResetting}
                    label="Отмена"
                    onPress={closeResetConfirmation}
                    style={styles.sheetFullWidthButton}
                    textStyle={styles.sheetActionButtonText}
                    variant="secondary"
                  />
                </View>
              </>
            )}
          </BottomSheetSafeArea>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  keyboardAvoider: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  safeArea: {
    flex: 1,
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  profileHeader: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarButton: {
    borderRadius: 31,
  },
  avatarButtonPressed: {
    opacity: 0.72,
  },
  profileTitleBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  profileTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
  },
  profileSubtitle: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '700',
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
  },
  photoActionRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  photoActionButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
  },
  photoRemoveButton: {
    minWidth: 82,
    minHeight: 42,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
  },
  photoActionText: {
    fontSize: 14,
  },
  nameInput: {
    minHeight: 52,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 18,
    fontWeight: '700',
  },
  birthDateField: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  birthDateFieldPressed: {
    backgroundColor: colors.primarySoft,
  },
  birthDateTextBlock: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  compactLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  birthDateValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  ageText: {
    flexShrink: 0,
    maxWidth: '45%',
    color: colors.primary,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
  },
  planLink: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  planLinkPressed: {
    backgroundColor: colors.primarySoft,
  },
  planLinkIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
  },
  planLinkTextBlock: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  planLinkTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  planLinkSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  planLinkArrow: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: '900',
  },
  featureToggleRow: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  featurePrompt: {
    gap: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  featureToggleTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  featurePromptTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 23,
  },
  featureToggleTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  featureToggleDescription: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  featurePromptActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  featurePromptButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
  },
  featurePromptButtonText: {
    fontSize: 15,
  },
  infoList: {
    gap: spacing.xs,
  },
  infoRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  infoLabel: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '700',
  },
  infoValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'right',
  },
  infoIcon: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  infoIconDot: {
    width: 4,
    height: 4,
    marginBottom: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  infoIconLine: {
    width: 4,
    height: 11,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  transferBlock: {
    gap: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  transferTextBlock: {
    gap: spacing.xs,
  },
  transferTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  transferText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  transferActions: {
    gap: spacing.sm,
  },
  dangerSection: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  dangerSectionTitle: {
    color: colors.danger,
    fontSize: 19,
    fontWeight: '900',
  },
  dangerBlock: {
    gap: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.md,
    backgroundColor: colors.dangerSoft,
  },
  dangerTitle: {
    color: colors.danger,
    fontSize: 17,
    fontWeight: '900',
  },
  dangerText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  aboutBlock: {
    minHeight: 76,
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  aboutTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  aboutText: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '700',
  },
  errorText: {
    borderRadius: radius.sm,
    padding: spacing.md,
    color: colors.warning,
    backgroundColor: colors.warningSoft,
    fontSize: 15,
    fontWeight: '700',
  },
  successText: {
    borderRadius: radius.sm,
    padding: spacing.md,
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    fontSize: 15,
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
    lineHeight: 28,
  },
  sheetText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 23,
  },
  sheetError: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sheetActionsVertical: {
    gap: spacing.sm,
  },
  sheetActionButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
  },
  sheetFullWidthButton: {
    minHeight: 50,
    borderRadius: radius.sm,
  },
  sheetActionButtonText: {
    fontSize: 15,
  },
});
