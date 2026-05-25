# Baby Sleep Planner

Минимальный Android-first offline-first каркас приложения для планирования сна ребёнка.

Фокус MVP:

- логирование сна;
- расчёт окон бодрствования;
- сравнение дня с целевым планом;
- прогноз следующего сна и ночи;
- простые сценарии: обычный план, микросон, ранний ночной.

В проекте нет backend, авторизации, кормлений, подгузников, роста и лекарств.

## Структура

```text
src/
  app/          Expo Router экраны
  components/   презентационные компоненты
  constants/    настройки плана сна и темы
  core/         чистые функции расчётов сна
  db/           SQLite схема и миграции
  types/        доменные TypeScript-типы
```

## Запуск

Установить зависимости:

```bash
npm install
```

Запустить Android:

```bash
npm run android
```

Открыть Expo dev server:

```bash
npm start
```

Проверить TypeScript:

```bash
npm run typecheck
```
