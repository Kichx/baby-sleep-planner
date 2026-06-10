import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockStyleSheet = {
  create: <Styles extends Record<string, unknown>>(styles: Styles) => Styles;
};

async function loadSubject({
  os = 'android',
  width = 360,
}: {
  os?: string;
  width?: number;
} = {}) {
  vi.resetModules();
  vi.clearAllMocks();
  (
    globalThis as typeof globalThis & {
      __babySleepPlannerOriginalStyleSheetCreate?: MockStyleSheet['create'];
    }
  ).__babySleepPlannerOriginalStyleSheetCreate = undefined;

  const text = {};
  const textInput = {};
  const styleSheet: MockStyleSheet = {
    create: vi.fn((styles) => styles),
  };

  vi.doMock('react-native', () => ({
    Dimensions: {
      get: () => ({ width }),
    },
    Platform: {
      OS: os,
    },
    StyleSheet: styleSheet,
    Text: text,
    TextInput: textInput,
  }));

  const subject = await import('@/textScaling');

  return {
    styleSheet,
    subject,
    text,
    textInput,
  };
}

describe('app text scaling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps wide screens at the designed text scale', async () => {
    const { subject } = await loadSubject();

    expect(subject.getAppTextScale(430)).toBe(1);
    expect(subject.getAppTextScale(390)).toBe(1);
  });

  it('uses a compact text scale on narrow logical screens', async () => {
    const { subject } = await loadSubject();

    expect(subject.getAppTextScale(360)).toBeCloseTo(360 / 390, 5);
    expect(subject.getAppTextScale(320)).toBe(0.9);
  });

  it('scales text metrics and keeps non-text styles unchanged', async () => {
    const { subject } = await loadSubject();
    const boxStyle = { padding: 16, backgroundColor: '#fff' };

    expect(
      subject.normalizeAppTextStyle(
        { color: '#111', fontSize: 20, fontWeight: '700', lineHeight: 24 },
        0.9,
        'Roboto',
      ),
    ).toEqual({
      color: '#111',
      fontFamily: 'Roboto',
      fontSize: 18,
      fontWeight: '700',
      includeFontPadding: false,
      lineHeight: 21.6,
    });
    expect(subject.normalizeAppTextStyle(boxStyle, 0.9, 'Roboto')).toBe(boxStyle);
  });

  it('patches StyleSheet.create before screen styles are created', async () => {
    const { styleSheet, text, textInput } = await loadSubject({ width: 360 });

    const styles = styleSheet.create({
      box: {
        padding: 16,
      },
      title: {
        fontSize: 20,
        fontWeight: '700',
        lineHeight: 24,
      },
    });

    expect(styles).toEqual({
      box: {
        padding: 16,
      },
      title: {
        fontFamily: 'Roboto',
        fontSize: 18.5,
        fontWeight: '700',
        includeFontPadding: false,
        lineHeight: 22.2,
      },
    });
    expect(text).toMatchObject({
      defaultProps: {
        allowFontScaling: false,
        maxFontSizeMultiplier: 1,
        style: {
          fontFamily: 'Roboto',
          includeFontPadding: false,
        },
      },
    });
    expect(textInput).toMatchObject({
      defaultProps: {
        allowFontScaling: false,
        maxFontSizeMultiplier: 1,
        style: {
          fontFamily: 'Roboto',
          includeFontPadding: false,
        },
      },
    });
  });
});
