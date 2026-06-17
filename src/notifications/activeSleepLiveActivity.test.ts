import { describe, expect, it, vi } from 'vitest';

import type { SleepSession } from '@/types/sleep';

interface LiveActivityInstanceMock {
  end: ReturnType<typeof vi.fn>;
  props: unknown;
  update: ReturnType<typeof vi.fn>;
}

function createLiveActivityInstanceMock(props: unknown): LiveActivityInstanceMock {
  const instance: LiveActivityInstanceMock = {
    end: vi.fn(async () => undefined),
    props,
    update: vi.fn(async (nextProps: unknown) => {
      instance.props = nextProps;
    }),
  };

  return instance;
}

function createExpoWidgetsMock() {
  const instances: LiveActivityInstanceMock[] = [];
  const getInstances = vi.fn(() => instances);
  const start = vi.fn((props: unknown) => {
    const instance = createLiveActivityInstanceMock(props);
    instances.push(instance);
    return instance;
  });
  const createLiveActivity = vi.fn(() => ({
    getInstances,
    start,
  }));

  return {
    createLiveActivity,
    createLiveActivityInstanceMock,
    getInstances,
    instances,
    start,
  };
}

const activeSleepSessionFixture: SleepSession = {
  childId: 'default-child',
  endedAt: null,
  id: 'sleep-1',
  kind: 'nap',
  startedAt: '2026-06-05T15:00:00.000Z',
};

async function loadSubject(platform: 'android' | 'ios' = 'ios') {
  vi.resetModules();

  const widgetsMock = createExpoWidgetsMock();

  vi.doMock('expo-widgets', () => ({
    createLiveActivity: widgetsMock.createLiveActivity,
  }));
  vi.doMock('react-native', () => ({
    Platform: {
      OS: platform,
    },
  }));
  vi.doMock('@expo/ui/swift-ui', () => ({
    HStack: (props: unknown) => props,
    Image: (props: unknown) => props,
    Text: (props: unknown) => props,
    VStack: (props: unknown) => props,
  }));
  vi.doMock('@expo/ui/swift-ui/modifiers', () => ({
    font: (props: unknown) => ({ font: props }),
    foregroundStyle: (props: unknown) => ({ foregroundStyle: props }),
    padding: (props: unknown) => ({ padding: props }),
  }));

  const subject = await import('@/notifications/activeSleepLiveActivity');

  return {
    ...subject,
    widgetsMock,
  };
}

describe('active sleep Live Activity', () => {
  it('starts ActiveSleepActivity with sleep session props', async () => {
    const { showActiveSleepLiveActivity, widgetsMock } = await loadSubject('ios');

    await expect(showActiveSleepLiveActivity(activeSleepSessionFixture)).resolves.toBe(true);

    expect(widgetsMock.createLiveActivity).toHaveBeenCalledWith(
      'ActiveSleepActivity',
      expect.any(Function),
    );
    expect(widgetsMock.start).toHaveBeenCalledWith(
      expect.objectContaining({
        kindLabel: 'Дневной сон',
        sessionId: 'sleep-1',
        startedAtMillis: new Date('2026-06-05T15:00:00.000Z').getTime(),
        startedAtLabel: expect.any(String),
      }),
      'babysleepplanner://',
    );
  });

  it('updates the first iOS activity and ends extra activities on repeated sync', async () => {
    const { showActiveSleepLiveActivity, widgetsMock } = await loadSubject('ios');

    await showActiveSleepLiveActivity(activeSleepSessionFixture);
    const firstActivity = widgetsMock.instances[0];
    const extraActivity = widgetsMock.createLiveActivityInstanceMock({
      sessionId: 'stale-sleep',
    });
    widgetsMock.instances.push(extraActivity);

    await expect(showActiveSleepLiveActivity(activeSleepSessionFixture)).resolves.toBe(true);

    expect(widgetsMock.start).toHaveBeenCalledTimes(1);
    expect(firstActivity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'sleep-1',
      }),
    );
    expect(firstActivity.end).not.toHaveBeenCalled();
    expect(extraActivity.end).toHaveBeenCalledWith('immediate');
  });

  it('ends all active iOS activities immediately', async () => {
    const { hideActiveSleepLiveActivity, showActiveSleepLiveActivity, widgetsMock } =
      await loadSubject('ios');

    await showActiveSleepLiveActivity(activeSleepSessionFixture);
    const firstActivity = widgetsMock.instances[0];

    await hideActiveSleepLiveActivity();

    expect(firstActivity.end).toHaveBeenCalledWith('immediate');
  });

  it('does not start Live Activity outside iOS', async () => {
    const { showActiveSleepLiveActivity, widgetsMock } = await loadSubject('android');

    await expect(showActiveSleepLiveActivity(activeSleepSessionFixture)).resolves.toBe(false);

    expect(widgetsMock.start).not.toHaveBeenCalled();
  });
});
