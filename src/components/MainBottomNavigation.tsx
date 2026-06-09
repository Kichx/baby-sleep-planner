import { type Href, usePathname, useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SleepPlanIcon } from '@/components/SleepPlanIcon';
import { SleepRetrospectiveIcon } from '@/components/SleepRetrospectiveIcon';
import { colors, radius, spacing } from '@/constants/theme';

const sleepIconSource = require('../../assets/images/night-sleep-crescent.png');

type MainBottomNavigationPath = '/' | '/sleep-plan' | '/sleep-retrospective' | '/profile';

interface MainBottomNavigationItem {
  accessibilityLabel: string;
  href: Href;
  icon: 'sleep' | 'plan' | 'history' | 'profile';
  label: string;
  path: MainBottomNavigationPath;
}

const MAIN_BOTTOM_NAVIGATION_ITEMS: MainBottomNavigationItem[] = [
  {
    accessibilityLabel: 'Сон',
    href: '/',
    icon: 'sleep',
    label: 'Сон',
    path: '/',
  },
  {
    accessibilityLabel: 'План дня',
    href: '/sleep-plan',
    icon: 'plan',
    label: 'План',
    path: '/sleep-plan',
  },
  {
    accessibilityLabel: 'История сна',
    href: '/sleep-retrospective',
    icon: 'history',
    label: 'История',
    path: '/sleep-retrospective',
  },
  {
    accessibilityLabel: 'Профиль',
    href: '/profile',
    icon: 'profile',
    label: 'Профиль',
    path: '/profile',
  },
];

function normalizePathname(pathname: string): string {
  if (pathname === '/') {
    return pathname;
  }

  return pathname.replace(/\/+$/, '');
}

export function shouldShowMainBottomNavigation(pathname: string): boolean {
  const normalizedPathname = normalizePathname(pathname);

  return MAIN_BOTTOM_NAVIGATION_ITEMS.some((item) => item.path === normalizedPathname);
}

function renderIcon(icon: MainBottomNavigationItem['icon'], isActive: boolean) {
  const iconToneStyle = isActive ? styles.activeRasterIcon : styles.inactiveRasterIcon;

  switch (icon) {
    case 'sleep':
      return (
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={sleepIconSource}
          style={[styles.sleepIcon, iconToneStyle]}
        />
      );
    case 'plan':
      return (
        <View style={[styles.rasterIconWrap, iconToneStyle]}>
          <SleepPlanIcon size={24} />
        </View>
      );
    case 'history':
      return (
        <View style={[styles.rasterIconWrap, iconToneStyle]}>
          <SleepRetrospectiveIcon size={24} />
        </View>
      );
    case 'profile':
      return (
        <View style={styles.profileIcon}>
          <View style={[styles.profileIconHead, isActive ? styles.profileIconActive : null]} />
          <View style={[styles.profileIconBody, isActive ? styles.profileIconBodyActive : null]} />
        </View>
      );
  }
}

export function MainBottomNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const activePathname = normalizePathname(pathname);

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <View style={styles.navBar}>
        {MAIN_BOTTOM_NAVIGATION_ITEMS.map((item) => {
          const isActive = item.path === activePathname;

          return (
            <Pressable
              accessibilityLabel={item.accessibilityLabel}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              key={item.path}
              onPress={() => router.replace(item.href)}
              style={({ pressed }) => [styles.item, pressed ? styles.itemPressed : null]}>
              <View
                style={[styles.activeIndicator, isActive ? styles.activeIndicatorVisible : null]}
              />
              <View style={styles.iconSlot}>{renderIcon(item.icon, isActive)}</View>
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.86}
                numberOfLines={1}
                style={[styles.label, isActive ? styles.activeLabel : null]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flexShrink: 0,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  navBar: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  item: {
    position: 'relative',
    flex: 1,
    minWidth: 0,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: radius.sm,
  },
  itemPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  activeIndicator: {
    position: 'absolute',
    top: 3,
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  activeIndicatorVisible: {
    backgroundColor: colors.primary,
  },
  iconSlot: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sleepIcon: {
    width: 25,
    height: 25,
  },
  rasterIconWrap: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeRasterIcon: {
    opacity: 1,
  },
  inactiveRasterIcon: {
    opacity: 0.56,
  },
  profileIcon: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileIconHead: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.textMuted,
  },
  profileIconActive: {
    backgroundColor: colors.primary,
  },
  profileIconBody: {
    width: 18,
    height: 9,
    marginTop: 2,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: colors.textMuted,
  },
  profileIconBodyActive: {
    borderColor: colors.primary,
  },
  label: {
    maxWidth: '100%',
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 15,
  },
  activeLabel: {
    color: colors.primary,
  },
});
