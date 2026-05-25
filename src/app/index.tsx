import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SleepSessionEditorModal } from '@/components/SleepSessionEditorModal';
import { SummaryCard } from '@/components/SummaryCard';
import { DEFAULT_SLEEP_PLAN } from '@/constants/sleep';
import { colors, radius, spacing } from '@/constants/theme';
import {
  addMinutes,
  buildTodaySleepSnapshot,
  getDayStart,
  getSessionDurationMinutes,
  inferSleepKindForInterval,
  inferSleepKindForStart,
} from '@/core/sleepCalculations';
import {
  createSleepSession,
  deleteSleepSession,
  ensureDefaultChildProfile,
  listSleepSessionsInRange,
  startSleepSession,
  stopActiveSleepSession,
  updateSleepSession,
} from '@/db';
import type { SleepSession } from '@/types/sleep';

type EditorState =
  | {
      mode: 'create';
      session: null;
      referenceDate: Date;
    }
  | {
      mode: 'edit';
      session: SleepSession;
      referenceDate: Date;
    };

function formatClock(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  if (hours === 0) {
    return `${restMinutes} мин`;
  }

  return `${hours} ч ${restMinutes} мин`;
}

export default function TodaySleepScreen() {
  const db = useSQLiteContext();
  const [sessions, setSessions] = useState<SleepSession[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<EditorState | null>(null);

  const loadSessions = useCallback(
    async (referenceDate: Date) => {
      await ensureDefaultChildProfile(db);

      const dayStart = getDayStart(referenceDate, DEFAULT_SLEEP_PLAN);
      const dayEnd = addMinutes(dayStart, 24 * 60);
      const loadedSessions = await listSleepSessionsInRange(db, dayStart, dayEnd);

      setSessions(loadedSessions);
    },
    [db],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadInitialState() {
      const referenceDate = new Date();

      try {
        await ensureDefaultChildProfile(db);

        const dayStart = getDayStart(referenceDate, DEFAULT_SLEEP_PLAN);
        const dayEnd = addMinutes(dayStart, 24 * 60);
        const loadedSessions = await listSleepSessionsInRange(db, dayStart, dayEnd);

        if (isMounted) {
          setNow(referenceDate);
          setSessions(loadedSessions);
          setErrorMessage(null);
        }
      } catch {
        if (isMounted) {
          setErrorMessage('Не удалось загрузить сон');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadInitialState();

    return () => {
      isMounted = false;
    };
  }, [db]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 30_000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const snapshot = useMemo(
    () => buildTodaySleepSnapshot(sessions, now, DEFAULT_SLEEP_PLAN),
    [sessions, now],
  );
  const isSleeping = snapshot.state === 'sleeping';
  const buttonLabel = isSaving
    ? 'Сохраняем...'
    : isSleeping
      ? 'Завершить сон'
      : 'Начать сон';

  const visibleSessions = useMemo(() => [...sessions].reverse(), [sessions]);

  async function handleSleepButtonPress() {
    const actionAt = new Date();

    setIsSaving(true);
    setErrorMessage(null);
    setNow(actionAt);

    try {
      if (isSleeping) {
        const activeSession = sessions.find((session) => session.endedAt === null);
        const sleepKind = activeSession
          ? inferSleepKindForInterval(
              new Date(activeSession.startedAt),
              actionAt,
              DEFAULT_SLEEP_PLAN,
            )
          : undefined;

        await stopActiveSleepSession(db, actionAt, sleepKind);
      } else {
        await startSleepSession(db, inferSleepKindForStart(actionAt, DEFAULT_SLEEP_PLAN), actionAt);
      }

      await loadSessions(actionAt);
    } catch {
      setErrorMessage('Не удалось сохранить сон');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleEditorSave(input: {
    startedAt: Date;
    endedAt: Date | null;
  }) {
    const actionAt = new Date();
    const inputWithKind = {
      ...input,
      kind: inferSleepKindForInterval(input.startedAt, input.endedAt, DEFAULT_SLEEP_PLAN),
    };

    setIsSaving(true);
    setErrorMessage(null);
    setNow(actionAt);

    try {
      if (editorState?.mode === 'edit') {
        await updateSleepSession(db, editorState.session.id, inputWithKind);
      } else {
        await createSleepSession(db, inputWithKind);
      }

      await loadSessions(actionAt);
      setEditorState(null);
    } catch {
      setErrorMessage('Не удалось сохранить запись');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleEditorDelete() {
    if (editorState?.mode !== 'edit') {
      return;
    }

    const actionAt = new Date();

    setIsSaving(true);
    setErrorMessage(null);
    setNow(actionAt);

    try {
      await deleteSleepSession(db, editorState.session.id);
      await loadSessions(actionAt);
      setEditorState(null);
    } catch {
      setErrorMessage('Не удалось удалить запись');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
        <SafeAreaView edges={['bottom']} style={styles.safeArea}>
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <View style={styles.hero}>
            <Text style={styles.status}>
              {isLoading ? 'Загрузка' : isSleeping ? 'Спит' : 'Бодрствует'}
            </Text>
            <Text style={styles.timer}>
              {isLoading ? '--' : formatDuration(snapshot.currentDurationMinutes)}
            </Text>
            <Text style={styles.helper}>с {formatClock(snapshot.statusStartedAt)}</Text>
          </View>

          <View style={styles.actionRow}>
            <PrimaryButton
              compact
              disabled={isLoading || isSaving}
              label={buttonLabel}
              onPress={handleSleepButtonPress}
              style={styles.timerButton}
            />
            <PrimaryButton
              compact
              disabled={isLoading || isSaving}
              label="Внести сон"
              onPress={() =>
                setEditorState({ mode: 'create', referenceDate: new Date(), session: null })
              }
              style={styles.manualButton}
              variant="secondary"
            />
          </View>

          <View style={styles.grid}>
            <SummaryCard
              title="Следующий сон"
              value={isSleeping ? 'после сна' : formatClock(snapshot.nextSleepAt)}
              caption={snapshot.onTrackLabel}
              tone="accent"
            />
            <SummaryCard
              title="Прогноз ночи"
              value={formatClock(snapshot.predictedBedtimeAt)}
              caption="по цели бодрствования"
            />
          </View>

          <View style={styles.grid}>
            <SummaryCard
              title="До цели бодрствования"
              value={formatDuration(snapshot.remainingAwakeMinutes)}
              caption={`всего ${formatDuration(snapshot.totalAwakeMinutes)}`}
            />
            <SummaryCard
              title="Сон днём"
              value={formatDuration(snapshot.totalDaySleepMinutes)}
              caption={`${snapshot.completedNaps} сна сегодня`}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Сценарии</Text>
            <View style={styles.scenarioList}>
              {snapshot.scenarios.map((scenario) => (
                <View
                  key={scenario.id}
                  style={[
                    styles.scenario,
                    scenario.priority === 'primary' ? styles.primaryScenario : null,
                  ]}>
                  <Text style={styles.scenarioTitle}>{scenario.title}</Text>
                  <Text style={styles.scenarioText}>{scenario.detail}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Записи сегодня</Text>
            <View style={styles.sessionList}>
              {visibleSessions.length === 0 ? (
                <Text style={styles.emptyText}>Пока нет записей сна</Text>
              ) : (
                visibleSessions.map((session) => {
                  const startedAt = new Date(session.startedAt);
                  const endedAt = session.endedAt ? new Date(session.endedAt) : null;

                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={session.id}
                      onPress={() =>
                        setEditorState({ mode: 'edit', referenceDate: new Date(), session })
                      }
                      style={({ pressed }) => [
                        styles.sessionRow,
                        pressed ? styles.sessionRowPressed : null,
                      ]}>
                      <View style={styles.sessionInfo}>
                        <Text style={styles.sessionTitle}>
                          {session.kind === 'night' ? 'Ночной сон' : 'Сон'}
                        </Text>
                        <Text style={styles.sessionTime}>
                          {formatClock(startedAt)} - {endedAt ? formatClock(endedAt) : 'идёт'}
                        </Text>
                      </View>
                      <Text style={styles.sessionDuration}>
                        {formatDuration(getSessionDurationMinutes(session, now))}
                      </Text>
                      <Text style={styles.sessionAction}>Изменить</Text>
                    </Pressable>
                  );
                })
              )}
            </View>
          </View>
        </SafeAreaView>
      </ScrollView>

      <SleepSessionEditorModal
        existingSessions={sessions}
        isSaving={isSaving}
        mode={editorState?.mode ?? 'create'}
        onClose={() => setEditorState(null)}
        onDelete={handleEditorDelete}
        onSave={handleEditorSave}
        referenceDate={editorState?.referenceDate ?? now}
        session={editorState?.session ?? null}
        visible={editorState !== null}
      />
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
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  hero: {
    minHeight: 172,
    borderRadius: radius.lg,
    padding: spacing.xl,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  status: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: '700',
  },
  timer: {
    marginTop: spacing.sm,
    color: colors.text,
    fontSize: 44,
    fontWeight: '900',
  },
  helper: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: 16,
  },
  errorText: {
    borderRadius: radius.sm,
    padding: spacing.md,
    color: colors.warning,
    backgroundColor: colors.warningSoft,
    fontSize: 15,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  timerButton: {
    flex: 1.25,
  },
  manualButton: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  scenarioList: {
    gap: spacing.sm,
  },
  scenario: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  primaryScenario: {
    borderColor: colors.primary,
  },
  scenarioTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  scenarioText: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
  },
  sessionList: {
    gap: spacing.sm,
  },
  emptyText: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.textMuted,
    backgroundColor: colors.surface,
    fontSize: 15,
  },
  sessionRow: {
    minHeight: 72,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sessionRowPressed: {
    backgroundColor: colors.primarySoft,
  },
  sessionInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  sessionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  sessionTime: {
    color: colors.textMuted,
    fontSize: 14,
  },
  sessionDuration: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  sessionAction: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '900',
  },
});
