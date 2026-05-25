import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';

import { colors } from '@/constants/theme';
import { DATABASE_NAME, migrateDatabase } from '@/db';

export default function RootLayout() {
  return (
    <>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDatabase}>
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: colors.background,
            },
            headerShadowVisible: false,
            headerTintColor: colors.text,
            headerTitleStyle: {
              fontWeight: '800',
            },
            contentStyle: {
              backgroundColor: colors.background,
            },
          }}>
          <Stack.Screen
            name="index"
            options={{
              title: 'Сон сегодня',
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
              title: 'План сна',
            }}
          />
        </Stack>
      </SQLiteProvider>
      <StatusBar style="dark" />
    </>
  );
}
