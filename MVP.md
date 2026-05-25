# MVP

## MVP objective

Build a simple offline Android-first app for tracking baby sleep and planning the rest of the day based on a target schedule.

## Main user flow

1. Parent opens the app.
2. Parent sees current status: awake or sleeping.
3. Parent taps "Начать сон" when baby falls asleep.
4. Parent taps "Завершить сон" when baby wakes up.
5. App recalculates:
   - current wake window;
   - total awake time;
   - total day sleep;
   - next recommended nap;
   - predicted bedtime;
   - deviation from target day.
6. App shows a simple recommendation.

## MVP screens

1. Today
2. Plan
3. History
4. Settings

## Success criteria

MVP is successful if it can be used daily for one child without server or internet and helps decide:
- when to put baby down for next nap;
- whether a micro-nap is needed;
- whether bedtime should be earlier;
- how far the day is from the target plan.