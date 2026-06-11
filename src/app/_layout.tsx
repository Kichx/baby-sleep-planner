import '@/textScaling';

import { Stack, usePathname } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

import {
  MainBottomNavigation,
  shouldShowMainBottomNavigation,
} from '@/components/MainBottomNavigation';
import { colors } from '@/constants/theme';
import { DATABASE_NAME, migrateDatabase } from '@/db';
import { ActiveSleepNotificationSync } from '@/notifications/ActiveSleepNotificationSync';
import { refreshSleepWidgetInBackground } from '@/widgets/sleepWidget';

async function initializeDatabase(db: Parameters<typeof migrateDatabase>[0]) {
  await migrateDatabase(db);
  refreshSleepWidgetInBackground();
}

function AppShell() {
  const pathname = usePathname();
  const shouldShowBottomNavigation = shouldShowMainBottomNavigation(pathname);

  return (
    <View style={styles.appShell}>
      <View style={styles.stackHost}>
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: colors.background,
            },
            headerShadowVisible: false,
            headerTintColor: colors.text,
            headerTitle: ({ children, tintColor }) => (
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.headerTitle, tintColor ? { color: tintColor } : null]}>
                {children}
              </Text>
            ),
            contentStyle: {
              backgroundColor: colors.background,
            },
          }}>
          <Stack.Screen
            name="index"
            options={{
              title: 'Сон',
            }}
          />
          <Stack.Screen
            name="first-run"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="profile"
            options={{
              title: 'Профиль',
            }}
          />
          <Stack.Screen
            name="sleep-plan"
            options={{
              title: 'План дня',
            }}
          />
          <Stack.Screen
            name="sleep-retrospective"
            options={{
              title: 'История сна',
            }}
          />
          <Stack.Screen
            name="bottle-feeding"
            options={{
              title: 'Кормление',
            }}
          />
          <Stack.Screen
            name="bottle-feeding-settings"
            options={{
              title: 'Настройки кормления',
            }}
          />
          <Stack.Screen
            name="info"
            options={{
              title: 'Справка',
            }}
          />
        </Stack>
      </View>
      {shouldShowBottomNavigation ? <MainBottomNavigation /> : null}
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={initializeDatabase}>
        <ActiveSleepNotificationSync />
        <AppShell />
      </SQLiteProvider>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
    backgroundColor: colors.background,
  },
  stackHost: {
    flex: 1,
    minHeight: 0,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
});
