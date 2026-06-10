import {
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from 'react-native';

type ComponentWithDefaultProps<Props> = {
  defaultProps?: Partial<Props>;
};

type AppStyle = Record<string, unknown>;
type AppStyleSheet = Record<string, unknown>;
type StyleSheetCreate = <Styles extends AppStyleSheet>(styles: Styles) => Styles;

declare global {
  // eslint-disable-next-line no-var
  var __babySleepPlannerOriginalStyleSheetCreate: StyleSheetCreate | undefined;
}

export const APP_TEXT_BASE_WIDTH = 390;
export const APP_TEXT_MIN_SCALE = 0.9;

export const ANDROID_APP_FONT_FAMILY = 'Roboto';
const TEXT_METRIC_KEYS = ['fontSize', 'lineHeight'] as const;
const TEXT_STYLE_HINT_KEYS = new Set([
  'fontFamily',
  'fontSize',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'includeFontPadding',
  'letterSpacing',
  'lineHeight',
  'textAlign',
  'textDecorationLine',
  'textTransform',
  'writingDirection',
]);

const fixedTextScalingProps = {
  allowFontScaling: false,
  maxFontSizeMultiplier: 1,
  style: getAppBaseTextStyle(),
} satisfies Pick<TextProps, 'allowFontScaling' | 'maxFontSizeMultiplier' | 'style'>;

const fixedTextInputScalingProps = {
  allowFontScaling: false,
  maxFontSizeMultiplier: 1,
  style: getAppBaseTextStyle(),
} satisfies Pick<TextInputProps, 'allowFontScaling' | 'maxFontSizeMultiplier' | 'style'>;

function getAppFontFamily() {
  return Platform.OS === 'android' ? ANDROID_APP_FONT_FAMILY : undefined;
}

function getAppBaseTextStyle(): TextStyle | undefined {
  const fontFamily = getAppFontFamily();

  if (!fontFamily) {
    return undefined;
  }

  return {
    fontFamily,
    includeFontPadding: false,
  };
}

function roundStyleMetric(value: number) {
  return Math.round(value * 10) / 10;
}

export function getAppTextScale(windowWidth = Dimensions.get('window').width) {
  if (!Number.isFinite(windowWidth) || windowWidth <= 0) {
    return 1;
  }

  return Math.max(APP_TEXT_MIN_SCALE, Math.min(1, windowWidth / APP_TEXT_BASE_WIDTH));
}

function isAppStyle(value: unknown): value is AppStyle {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasTextStyleHint(style: AppStyle) {
  return Object.keys(style).some((key) => TEXT_STYLE_HINT_KEYS.has(key));
}

export function normalizeAppTextStyle(
  style: unknown,
  textScale = getAppTextScale(),
  fontFamily = getAppFontFamily(),
): unknown {
  if (Array.isArray(style)) {
    return style.map((item) => normalizeAppTextStyle(item, textScale, fontFamily));
  }

  if (!isAppStyle(style)) {
    return style;
  }

  let nextStyle: AppStyle | null = null;

  for (const key of TEXT_METRIC_KEYS) {
    const value = style[key];

    if (typeof value === 'number' && Number.isFinite(value)) {
      nextStyle = nextStyle ?? { ...style };
      nextStyle[key] = roundStyleMetric(value * textScale);
    }
  }

  if (
    fontFamily &&
    style.fontFamily === undefined &&
    hasTextStyleHint(style)
  ) {
    nextStyle = nextStyle ?? { ...style };
    nextStyle.fontFamily = fontFamily;
  }

  if (
    fontFamily &&
    style.includeFontPadding === undefined &&
    hasTextStyleHint(style)
  ) {
    nextStyle = nextStyle ?? { ...style };
    nextStyle.includeFontPadding = false;
  }

  return nextStyle ?? style;
}

function normalizeAppStyleSheet<Styles extends AppStyleSheet>(
  styles: Styles,
  textScale = getAppTextScale(),
  fontFamily = getAppFontFamily(),
): Styles {
  let nextStyles: AppStyleSheet | null = null;

  for (const key of Object.keys(styles)) {
    const value = styles[key];
    const nextValue = normalizeAppTextStyle(value, textScale, fontFamily);

    if (nextValue !== value) {
      nextStyles = nextStyles ?? { ...styles };
      nextStyles[key] = nextValue;
    }
  }

  return (nextStyles ?? styles) as Styles;
}

function applyDefaultProps<Props>(
  component: ComponentWithDefaultProps<Props>,
  defaultProps: Partial<Props>,
) {
  component.defaultProps = {
    ...component.defaultProps,
    ...defaultProps,
  };
}

function configureAppStyleSheet() {
  const mutableStyleSheet = StyleSheet as unknown as { create: StyleSheetCreate };
  const originalStyleSheetCreate =
    globalThis.__babySleepPlannerOriginalStyleSheetCreate ??
    (mutableStyleSheet.create.bind(StyleSheet) as StyleSheetCreate);

  globalThis.__babySleepPlannerOriginalStyleSheetCreate = originalStyleSheetCreate;
  mutableStyleSheet.create = ((styles) =>
    originalStyleSheetCreate(normalizeAppStyleSheet(styles))) as StyleSheetCreate;
}

export function configureAppTextScaling() {
  configureAppStyleSheet();
  applyDefaultProps(Text as unknown as ComponentWithDefaultProps<TextProps>, fixedTextScalingProps);
  applyDefaultProps(
    TextInput as unknown as ComponentWithDefaultProps<TextInputProps>,
    fixedTextInputScalingProps,
  );
}

configureAppTextScaling();
