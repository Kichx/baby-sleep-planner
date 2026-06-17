import { HStack, Image, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivity } from 'expo-widgets';
import { Platform } from 'react-native';

import { formatLocalClock } from '@/core/localDateTime';
import type { SleepKind, SleepSession } from '@/types/sleep';

export interface ActiveSleepActivityProps {
  sessionId: string;
  startedAtMillis: number;
  startedAtLabel: string;
  kindLabel: string;
}

const ACTIVE_SLEEP_ACTIVITY_NAME = 'ActiveSleepActivity';
const ACTIVE_SLEEP_ACTIVITY_DEEP_LINK = 'babysleepplanner://';
const ACTIVE_SLEEP_ACTIVITY_ACCENT = '#2F5D50';

function getSleepKindLabel(kind: SleepKind): string {
  return kind === 'night' ? 'Ночной сон' : 'Дневной сон';
}

function buildActiveSleepActivityProps(session: SleepSession): ActiveSleepActivityProps {
  const startedAt = new Date(session.startedAt);

  return {
    kindLabel: getSleepKindLabel(session.kind),
    sessionId: session.id,
    startedAtLabel: formatLocalClock(startedAt),
    startedAtMillis: startedAt.getTime(),
  };
}

function renderTimer(startedAt: Date) {
  return (
    <Text
      date={startedAt}
      dateStyle="timer"
      modifiers={[font({ weight: 'bold' }), foregroundStyle(ACTIVE_SLEEP_ACTIVITY_ACCENT)]}
    />
  );
}

function ActiveSleepActivityView(props: ActiveSleepActivityProps) {
  'widget';

  const startedAt = new Date(props.startedAtMillis);

  return {
    banner: (
      <VStack alignment="leading" spacing={4} modifiers={[padding({ all: 12 })]}>
        <Text
          modifiers={[font({ textStyle: 'headline', weight: 'bold' }), foregroundStyle(ACTIVE_SLEEP_ACTIVITY_ACCENT)]}
        >
          Сон идёт
        </Text>
        <HStack alignment="center" spacing={6}>
          <Text>{props.kindLabel}</Text>
          {renderTimer(startedAt)}
        </HStack>
        <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
          С {props.startedAtLabel}
        </Text>
      </VStack>
    ),
    compactLeading: <Image systemName="moon.fill" color={ACTIVE_SLEEP_ACTIVITY_ACCENT} />,
    compactTrailing: renderTimer(startedAt),
    minimal: <Image systemName="moon.fill" color={ACTIVE_SLEEP_ACTIVITY_ACCENT} />,
    expandedLeading: (
      <VStack alignment="center" spacing={2} modifiers={[padding({ all: 8 })]}>
        <Image systemName="moon.fill" color={ACTIVE_SLEEP_ACTIVITY_ACCENT} />
        <Text modifiers={[font({ size: 12 })]}>Сон</Text>
      </VStack>
    ),
    expandedTrailing: (
      <VStack alignment="trailing" spacing={2} modifiers={[padding({ all: 8 })]}>
        {renderTimer(startedAt)}
        <Text modifiers={[font({ size: 12 }), foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
          с {props.startedAtLabel}
        </Text>
      </VStack>
    ),
    expandedBottom: (
      <VStack alignment="leading" spacing={2} modifiers={[padding({ all: 8 })]}>
        <Text modifiers={[font({ weight: 'bold' })]}>Сон идёт</Text>
        <Text>{props.kindLabel}</Text>
      </VStack>
    ),
  };
}

const ActiveSleepActivity = createLiveActivity<ActiveSleepActivityProps>(
  ACTIVE_SLEEP_ACTIVITY_NAME,
  ActiveSleepActivityView,
);

function canUseActiveSleepLiveActivity(): boolean {
  return Platform.OS === 'ios';
}

async function endExtraActivities(
  instances: LiveActivity<ActiveSleepActivityProps>[],
): Promise<void> {
  if (instances.length <= 1) {
    return;
  }

  await Promise.allSettled(instances.slice(1).map((instance) => instance.end('immediate')));
}

export async function showActiveSleepLiveActivity(session: SleepSession): Promise<boolean> {
  if (!canUseActiveSleepLiveActivity()) {
    return false;
  }

  try {
    const props = buildActiveSleepActivityProps(session);
    const instances = ActiveSleepActivity.getInstances();
    const primaryInstance = instances[0];

    if (primaryInstance) {
      await primaryInstance.update(props);
      await endExtraActivities(instances);
      return true;
    }

    ActiveSleepActivity.start(props, ACTIVE_SLEEP_ACTIVITY_DEEP_LINK);
    return true;
  } catch {
    return false;
  }
}

export async function hideActiveSleepLiveActivity(): Promise<void> {
  if (!canUseActiveSleepLiveActivity()) {
    return;
  }

  try {
    const instances = ActiveSleepActivity.getInstances();
    await Promise.allSettled(instances.map((instance) => instance.end('immediate')));
  } catch {
    // Live Activity cleanup should never block sleep logging.
  }
}
