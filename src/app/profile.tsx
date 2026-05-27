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
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { SleepPlanIcon } from '@/components/SleepPlanIcon';
import { DEFAULT_CHILD_NAME } from '@/constants/sleep';
import { colors, radius, spacing } from '@/constants/theme';
import {
  APP_DATA_BACKUP_MIME_TYPE,
  DataTransferError,
  buildAppDataBackup,
  deleteProfilePhotoCopy,
  getChildProfile,
  parseAppDataBackup,
  restoreAppDataBackup,
  saveProfilePhotoCopy,
  serializeAppDataBackup,
  updateChildProfile,
  updateChildProfilePhotoUri,
} from '@/db';

const SLEEP_PLAN_ROUTE = '/sleep-plan' as Href;
const INFO_ROUTE = '/info' as Href;

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
  childProfiles: number;
  sleepSessions: number;
  targetDayPlans: number;
}): string {
  return [
    `Профилей: ${summary.childProfiles}`,
    `Записей сна: ${summary.sleepSessions}`,
    `Планов сна: ${summary.targetDayPlans}`,
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
  const [isPhotoSaving, setIsPhotoSaving] = useState(false);
  const [isDataTransferRunning, setIsDataTransferRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const trimmedDraftName = draftName.trim();
  const draftBirthDateValue = useMemo(() => parseBirthDateValue(draftBirthDate), [draftBirthDate]);
  const birthDateLabel = draftBirthDateValue ? formatBirthDate(draftBirthDateValue) : 'Выбрать';
  const ageLabel = draftBirthDateValue
    ? `Возраст: ${formatAgeFromBirthDate(draftBirthDateValue, new Date())}`
    : 'Возраст: не указан';
  const hasProfileChanges =
    trimmedDraftName.length > 0 &&
    (trimmedDraftName !== profileName || draftBirthDate !== birthDate);
  const isBusy = isLoading || isSaving || isPhotoSaving || isDataTransferRunning;

  function applyProfile(profile: {
    name: string;
    birthDate: string | null;
    photoUri: string | null;
  }) {
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
    if (trimmedDraftName.length === 0) {
      setErrorMessage('Введите имя ребёнка');
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

  async function handleExportData() {
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
    } catch (error) {
      setErrorMessage(getTransferErrorMessage(error, 'Не удалось выгрузить данные'));
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
                maxLength={32}
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
                  <Text numberOfLines={1} style={styles.birthDateValue}>
                    {birthDateLabel}
                  </Text>
                </View>
                <Text numberOfLines={2} style={styles.ageText}>
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
                    onPress={handleExportData}
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
                <Text style={styles.aboutText}>Версия 1.0.0</Text>
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
          </SafeAreaView>
        </ScrollView>
      </KeyboardAvoidingView>
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
    gap: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
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
    maxWidth: 132,
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
});
