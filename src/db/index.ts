export { migrateDatabase } from '@/db/database';
export { DATABASE_NAME, DATABASE_VERSION, INITIAL_SCHEMA_SQL } from '@/db/schema';
export {
  createSleepSession,
  deleteSleepSession,
  ensureDefaultChildProfile,
  getActiveSleepSession,
  getChildProfile,
  listSleepSessionsInRange,
  startSleepSession,
  stopActiveSleepSession,
  updateChildProfile,
  updateChildProfileName,
  updateSleepSession,
} from '@/db/sleepRepository';
