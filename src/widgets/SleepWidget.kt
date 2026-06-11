package widgets

import android.Manifest
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.os.Build
import android.widget.RemoteViews
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID
import java.io.File
import kotlin.math.max
import kotlin.math.roundToInt
import notifications.ActiveSleepNotificationService

class SleepWidget : Module() {
  override fun definition() = ModuleDefinition {
    Name("SleepWidget")

    Function("refresh") {
      val reactContext = appContext.reactContext ?: return@Function false
      SleepToggleWidgetProvider.refreshAll(reactContext.applicationContext)
      return@Function true
    }
  }
}

class SleepToggleWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray,
  ) {
    updateWidgets(context, appWidgetManager, appWidgetIds)
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)

    if (intent.action != ACTION_TOGGLE_SLEEP) {
      return
    }

    val result = SleepWidgetRepository.toggleSleep(context, Date())

    when (result) {
      is ToggleResult.Started -> showActiveSleepNotificationIfAllowed(
        context,
        result.startedAtMillis,
        formatClock(result.startedAtMillis),
      )
      is ToggleResult.Stopped -> hideActiveSleepNotification(context)
      ToggleResult.NeedsApp,
      ToggleResult.NoWidgetChange -> Unit
    }

    refreshAll(context)
  }

  companion object {
    private const val ACTION_TOGGLE_SLEEP = "widgets.SleepToggleWidgetProvider.TOGGLE_SLEEP"
    private const val TOGGLE_REQUEST_CODE = 2401
    private const val LAUNCH_REQUEST_CODE = 2402

    fun refreshAll(context: Context) {
      val appWidgetManager = AppWidgetManager.getInstance(context)
      val componentName = ComponentName(context, SleepToggleWidgetProvider::class.java)
      val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)

      updateWidgets(context, appWidgetManager, appWidgetIds)
    }

    private fun updateWidgets(
      context: Context,
      appWidgetManager: AppWidgetManager,
      appWidgetIds: IntArray,
    ) {
      if (appWidgetIds.isEmpty()) {
        return
      }

      val state = SleepWidgetRepository.getWidgetState(context, Date())

      for (appWidgetId in appWidgetIds) {
        val views = buildRemoteViews(context, state) ?: continue
        appWidgetManager.updateAppWidget(appWidgetId, views)
      }
    }

    private fun buildRemoteViews(context: Context, state: WidgetState): RemoteViews? {
      val layoutId = resourceId(context, "sleep_toggle_widget", "layout")
      val rootId = resourceId(context, "sleep_widget_root", "id")
      val titleId = resourceId(context, "sleep_widget_title", "id")
      val subtitleId = resourceId(context, "sleep_widget_subtitle", "id")
      val buttonId = resourceId(context, "sleep_widget_button", "id")

      if (layoutId == 0 || titleId == 0 || subtitleId == 0 || buttonId == 0) {
        return null
      }

      val views = RemoteViews(context.packageName, layoutId)
      views.setTextViewText(titleId, state.title)
      views.setTextViewText(subtitleId, state.subtitle)
      views.setTextViewText(buttonId, state.button)

      val buttonIntent = when (state) {
        WidgetState.NeedsApp -> createLaunchPendingIntent(context)
        else -> createTogglePendingIntent(context)
      }

      if (buttonIntent != null) {
        views.setOnClickPendingIntent(buttonId, buttonIntent)
      }

      createLaunchPendingIntent(context)?.let { launchIntent ->
        if (rootId != 0) {
          views.setOnClickPendingIntent(rootId, launchIntent)
        }
      }

      return views
    }

    private fun createTogglePendingIntent(context: Context): PendingIntent {
      val intent = Intent(context, SleepToggleWidgetProvider::class.java).apply {
        action = ACTION_TOGGLE_SLEEP
      }

      return PendingIntent.getBroadcast(
        context,
        TOGGLE_REQUEST_CODE,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }

    private fun createLaunchPendingIntent(context: Context): PendingIntent? {
      val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        ?: return null

      intent.flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP

      return PendingIntent.getActivity(
        context,
        LAUNCH_REQUEST_CODE,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }

    private fun resourceId(context: Context, name: String, type: String): Int {
      return context.resources.getIdentifier(name, type, context.packageName)
    }

    private fun canPostNotifications(context: Context): Boolean {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
        return true
      }

      return ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.POST_NOTIFICATIONS,
      ) == PackageManager.PERMISSION_GRANTED
    }

    private fun showActiveSleepNotificationIfAllowed(
      context: Context,
      startedAtMillis: Long,
      startedAtLabel: String,
    ) {
      if (!canPostNotifications(context)) {
        return
      }

      val intent = ActiveSleepNotificationService.createShowIntent(
        context,
        startedAtMillis,
        startedAtLabel,
      )

      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          ContextCompat.startForegroundService(context, intent)
        } else {
          context.startService(intent)
        }
      } catch (_: Exception) {
        // Widget writes must not depend on notification availability.
      }
    }

    private fun hideActiveSleepNotification(context: Context) {
      ActiveSleepNotificationService.cancelNotifications(context)

      try {
        context.startService(ActiveSleepNotificationService.createHideIntent(context))
      } catch (_: Exception) {
        // Canceling the notification is enough when the service is already stopped.
      }
    }
  }
}

private sealed class WidgetState(
  val title: String,
  val subtitle: String,
  val button: String,
) {
  data class Awake(val latestEndedAtMillis: Long?) : WidgetState(
    title = "Бодрствует",
    subtitle = latestEndedAtMillis?.let { "последний сон до ${formatClock(it)}" }
      ?: "записей пока нет",
    button = "Начать сон",
  )

  data class Sleeping(val startedAtMillis: Long) : WidgetState(
    title = "Сон идёт",
    subtitle = "с ${formatClock(startedAtMillis)}",
    button = "Завершить",
  )

  object NeedsApp : WidgetState(
    title = "Откройте приложение",
    subtitle = "нужно обновить данные",
    button = "Открыть",
  )
}

private sealed class ToggleResult {
  data class Started(val startedAtMillis: Long) : ToggleResult()
  data class Stopped(val endedAtMillis: Long) : ToggleResult()
  object NeedsApp : ToggleResult()
  object NoWidgetChange : ToggleResult()
}

private data class ActiveSession(
  val id: String,
  val kind: String,
  val startedAtIso: String,
  val startedAtMillis: Long,
)

private data class SleepPlan(
  val sourcePlanId: String?,
  val sourcePlanName: String,
  val dayStartMinutes: Int,
  val wakeUpStartMinutes: Int,
  val wakeUpEndMinutes: Int,
  val targetAwakeMinMinutes: Int,
  val targetAwakeMaxMinutes: Int,
  val targetAwakeMinutes: Int,
  val napCount: Int,
  val targetDaySleepMinMinutes: Int,
  val targetDaySleepMaxMinutes: Int,
  val targetDaySleepMinutes: Int,
  val bedtimeTargetMinutes: Int,
  val earlyBedtimeMinutes: Int,
  val latestEveningNapEndMinutes: Int,
  val maxEveningNapMinutes: Int,
  val minNightSleepMinutes: Int,
  val microNapMinutes: Int,
)

private object SleepWidgetRepository {
  private const val DATABASE_NAME = "baby_sleep_planner.db"
  private const val DATABASE_VERSION = 17
  private const val DEFAULT_CHILD_ID = "default-child"
  private const val DEFAULT_CHILD_NAME = "Ребёнок"
  private const val DEFAULT_PLAN_NAME = "Основной"
  private const val DAY_MINUTES = 24 * 60
  private const val DEFAULT_WAKE_UP_START_MINUTES = 6 * 60 + 50
  private const val DEFAULT_WAKE_UP_END_MINUTES = 7 * 60 + 10
  private const val DEFAULT_TARGET_AWAKE_MIN_MINUTES = 10 * 60
  private const val DEFAULT_TARGET_AWAKE_MAX_MINUTES = 10 * 60 + 30
  private const val DEFAULT_TARGET_DAY_SLEEP_MIN_MINUTES = 3 * 60
  private const val DEFAULT_TARGET_DAY_SLEEP_MAX_MINUTES = 3 * 60 + 30
  private const val DEFAULT_NAP_COUNT = 3
  private const val DEFAULT_MIN_NIGHT_SLEEP_MINUTES = 3 * 60
  private const val EARLY_BEDTIME_OFFSET_MINUTES = 60
  private const val SINGLE_NAP_LATEST_END_BEFORE_BEDTIME_MINUTES = 180
  private const val TWO_NAP_LATEST_END_BEFORE_BEDTIME_MINUTES = 120
  private const val MANY_NAP_LATEST_END_BEFORE_BEDTIME_MINUTES = 0
  private const val SINGLE_NAP_MAX_EVENING_NAP_MINUTES = 30
  private const val TWO_NAP_MAX_EVENING_NAP_MINUTES = 40
  private const val MANY_NAP_MAX_EVENING_NAP_MINUTES = 45
  private const val SINGLE_NAP_MICRO_NAP_MINUTES = 0
  private const val TWO_NAP_MICRO_NAP_MINUTES = 15
  private const val MANY_NAP_MICRO_NAP_MINUTES = 20

  private val isoFormatter = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
    timeZone = TimeZone.getTimeZone("UTC")
  }
  private val localDateFormatter = SimpleDateFormat("yyyy-MM-dd", Locale.US)

  fun getWidgetState(context: Context, now: Date): WidgetState {
    return try {
      openDatabase(context, SQLiteDatabase.OPEN_READONLY).use { db ->
        if (!isDatabaseReady(db)) {
          return WidgetState.NeedsApp
        }

        val activeSession = queryActiveSleepSession(db)
        if (activeSession != null) {
          return WidgetState.Sleeping(activeSession.startedAtMillis)
        }

        WidgetState.Awake(queryLatestSleepEndedAt(db))
      }
    } catch (_: Exception) {
      WidgetState.NeedsApp
    }
  }

  fun toggleSleep(context: Context, now: Date): ToggleResult {
    return synchronized(this) {
      try {
        openDatabase(context, SQLiteDatabase.OPEN_READWRITE).use { db ->
          if (!isDatabaseReady(db)) {
            return@synchronized ToggleResult.NeedsApp
          }

          val nowIso = formatIso(now)
          val nowMillis = now.time
          db.beginTransaction()

          try {
            ensureDefaultChildProfile(db, nowIso)

            val plan = queryActivePlan(db)
            val activeSession = queryActiveSleepSession(db)
            val result = if (activeSession == null) {
              val kind = inferSleepKind(nowMillis, null, plan)
              val sessionId = createSleepSessionId(nowMillis)

              db.execSQL(
                """
                INSERT INTO sleep_sessions (id, child_id, kind, started_at, ended_at)
                VALUES (?, ?, ?, ?, ?)
                """.trimIndent(),
                arrayOf(sessionId, DEFAULT_CHILD_ID, kind, nowIso, null),
              )

              upsertSleepDayPlanSnapshotsForSession(
                db,
                plan,
                nowMillis,
                null,
                nowMillis,
                nowIso,
              )

              ToggleResult.Started(nowMillis)
            } else {
              val inferredKind = inferSleepKind(activeSession.startedAtMillis, nowMillis, plan)

              db.execSQL(
                """
                UPDATE sleep_sessions
                SET ended_at = ?, kind = ?
                WHERE id = ? AND child_id = ? AND ended_at IS NULL
                """.trimIndent(),
                arrayOf(nowIso, inferredKind, activeSession.id, DEFAULT_CHILD_ID),
              )

              upsertSleepDayPlanSnapshotsForSession(
                db,
                plan,
                activeSession.startedAtMillis,
                nowMillis,
                nowMillis,
                nowIso,
              )

              ToggleResult.Stopped(nowMillis)
            }

            db.setTransactionSuccessful()
            return@synchronized result
          } finally {
            db.endTransaction()
          }
        }
      } catch (_: Exception) {
        ToggleResult.NeedsApp
      }
    }
  }

  private fun openDatabase(context: Context, flags: Int): SQLiteDatabase {
    val dbFile = File(File(context.filesDir, "SQLite"), DATABASE_NAME)

    if (!dbFile.exists()) {
      throw IllegalStateException("Database does not exist")
    }

    return SQLiteDatabase.openDatabase(dbFile.absolutePath, null, flags)
  }

  private fun isDatabaseReady(db: SQLiteDatabase): Boolean {
    db.rawQuery("PRAGMA user_version", null).use { cursor ->
      if (!cursor.moveToFirst()) {
        return false
      }

      return cursor.getInt(0) >= DATABASE_VERSION
    }
  }

  private fun ensureDefaultChildProfile(db: SQLiteDatabase, nowIso: String) {
    db.execSQL(
      """
      INSERT OR IGNORE INTO child_profile (id, name, birth_date, photo_uri, created_at)
      VALUES (?, ?, ?, ?, ?)
      """.trimIndent(),
      arrayOf(DEFAULT_CHILD_ID, DEFAULT_CHILD_NAME, null, null, nowIso),
    )
  }

  private fun queryActiveSleepSession(db: SQLiteDatabase): ActiveSession? {
    db.rawQuery(
      """
      SELECT id, kind, started_at
      FROM sleep_sessions
      WHERE child_id = ? AND ended_at IS NULL
      ORDER BY started_at DESC
      LIMIT 1
      """.trimIndent(),
      arrayOf(DEFAULT_CHILD_ID),
    ).use { cursor ->
      if (!cursor.moveToFirst()) {
        return null
      }

      val startedAtIso = cursor.getString(2)

      return ActiveSession(
        id = cursor.getString(0),
        kind = cursor.getString(1),
        startedAtIso = startedAtIso,
        startedAtMillis = parseIso(startedAtIso)?.time ?: return null,
      )
    }
  }

  private fun queryLatestSleepEndedAt(db: SQLiteDatabase): Long? {
    db.rawQuery(
      """
      SELECT ended_at
      FROM sleep_sessions
      WHERE child_id = ? AND ended_at IS NOT NULL
      ORDER BY ended_at DESC
      LIMIT 1
      """.trimIndent(),
      arrayOf(DEFAULT_CHILD_ID),
    ).use { cursor ->
      if (!cursor.moveToFirst()) {
        return null
      }

      return parseIso(cursor.getString(0))?.time
    }
  }

  private fun queryActivePlan(db: SQLiteDatabase): SleepPlan {
    db.rawQuery(
      """
      SELECT
        id,
        name,
        evening_rules_mode,
        wake_up_start_minutes,
        wake_up_end_minutes,
        target_awake_min_minutes,
        target_awake_max_minutes,
        target_awake_minutes,
        nap_count,
        target_day_sleep_min_minutes,
        target_day_sleep_max_minutes,
        target_day_sleep_minutes,
        bedtime_target_minutes,
        latest_evening_nap_end_minutes,
        max_evening_nap_minutes,
        micro_nap_minutes
      FROM target_day_plan
      WHERE child_id = ? AND is_active = 1
      ORDER BY updated_at DESC
      LIMIT 1
      """.trimIndent(),
      arrayOf(DEFAULT_CHILD_ID),
    ).use { cursor ->
      if (!cursor.moveToFirst()) {
        return defaultPlan()
      }

      return mapTargetDayPlan(cursor)
    }
  }

  private fun mapTargetDayPlan(cursor: Cursor): SleepPlan {
    val targetAwakeMinutes = cursor.getIntOrDefault(7, defaultPlan().targetAwakeMinutes)
    val targetDaySleepMinutes = cursor.getIntOrDefault(11, defaultPlan().targetDaySleepMinutes)
    val bedtimeTargetFromRow = cursor.getIntOrDefault(12, defaultPlan().bedtimeTargetMinutes)
    val legacyWakeUpMinutes = bedtimeTargetFromRow - targetAwakeMinutes - targetDaySleepMinutes
    val wakeUpStartMinutes = cursor.getIntOrDefault(
      3,
      if (legacyWakeUpMinutes in 0 until DAY_MINUTES) {
        legacyWakeUpMinutes
      } else {
        defaultPlan().wakeUpStartMinutes
      },
    )
    val wakeUpEndMinutes = cursor.getIntOrDefault(4, wakeUpStartMinutes)
    val targetAwakeMinMinutes = cursor.getIntOrDefault(5, targetAwakeMinutes)
    val targetAwakeMaxMinutes = cursor.getIntOrDefault(6, targetAwakeMinutes)
    val napCount = clampNapCount(cursor.getIntOrDefault(8, defaultPlan().napCount))
    val targetDaySleepMinMinutes = cursor.getIntOrDefault(9, targetDaySleepMinutes)
    val targetDaySleepMaxMinutes = cursor.getIntOrDefault(10, targetDaySleepMinutes)
    val bedtimeTargetMinutes = normalizeClockMinutes(
      wakeUpStartMinutes + targetAwakeMinMinutes + targetDaySleepMinMinutes,
    )
    val isCustomEveningRules = cursor.getStringOrNull(2) == "custom"
    val eveningRules = if (isCustomEveningRules) {
      EveningRules(
        latestEveningNapEndMinutes = cursor.getIntOrDefault(
          13,
          defaultPlan().latestEveningNapEndMinutes,
        ),
        maxEveningNapMinutes = cursor.getIntOrDefault(14, defaultPlan().maxEveningNapMinutes),
        microNapMinutes = cursor.getIntOrDefault(15, defaultPlan().microNapMinutes),
      )
    } else {
      deriveEveningRules(
        napCount = napCount,
        bedtimeTargetMinutes = bedtimeTargetMinutes,
      )
    }

    return SleepPlan(
      sourcePlanId = cursor.getStringOrNull(0),
      sourcePlanName = cursor.getStringOrNull(1)?.trim()?.takeIf { it.isNotEmpty() }
        ?: DEFAULT_PLAN_NAME,
      dayStartMinutes = wakeUpStartMinutes,
      wakeUpStartMinutes = wakeUpStartMinutes,
      wakeUpEndMinutes = wakeUpEndMinutes,
      targetAwakeMinMinutes = targetAwakeMinMinutes,
      targetAwakeMaxMinutes = targetAwakeMaxMinutes,
      targetAwakeMinutes = midpoint(targetAwakeMinMinutes, targetAwakeMaxMinutes),
      napCount = napCount,
      targetDaySleepMinMinutes = targetDaySleepMinMinutes,
      targetDaySleepMaxMinutes = targetDaySleepMaxMinutes,
      targetDaySleepMinutes = midpoint(targetDaySleepMinMinutes, targetDaySleepMaxMinutes),
      bedtimeTargetMinutes = bedtimeTargetMinutes,
      earlyBedtimeMinutes = normalizeClockMinutes(bedtimeTargetMinutes - EARLY_BEDTIME_OFFSET_MINUTES),
      latestEveningNapEndMinutes = eveningRules.latestEveningNapEndMinutes,
      maxEveningNapMinutes = eveningRules.maxEveningNapMinutes,
      minNightSleepMinutes = DEFAULT_MIN_NIGHT_SLEEP_MINUTES,
      microNapMinutes = eveningRules.microNapMinutes,
    )
  }

  private fun defaultPlan(): SleepPlan {
    val bedtimeTargetMinutes = normalizeClockMinutes(
      DEFAULT_WAKE_UP_START_MINUTES +
        DEFAULT_TARGET_AWAKE_MIN_MINUTES +
        DEFAULT_TARGET_DAY_SLEEP_MIN_MINUTES,
    )
    val eveningRules = deriveEveningRules(DEFAULT_NAP_COUNT, bedtimeTargetMinutes)

    return SleepPlan(
      sourcePlanId = null,
      sourcePlanName = DEFAULT_PLAN_NAME,
      dayStartMinutes = DEFAULT_WAKE_UP_START_MINUTES,
      wakeUpStartMinutes = DEFAULT_WAKE_UP_START_MINUTES,
      wakeUpEndMinutes = DEFAULT_WAKE_UP_END_MINUTES,
      targetAwakeMinMinutes = DEFAULT_TARGET_AWAKE_MIN_MINUTES,
      targetAwakeMaxMinutes = DEFAULT_TARGET_AWAKE_MAX_MINUTES,
      targetAwakeMinutes = midpoint(
        DEFAULT_TARGET_AWAKE_MIN_MINUTES,
        DEFAULT_TARGET_AWAKE_MAX_MINUTES,
      ),
      napCount = DEFAULT_NAP_COUNT,
      targetDaySleepMinMinutes = DEFAULT_TARGET_DAY_SLEEP_MIN_MINUTES,
      targetDaySleepMaxMinutes = DEFAULT_TARGET_DAY_SLEEP_MAX_MINUTES,
      targetDaySleepMinutes = midpoint(
        DEFAULT_TARGET_DAY_SLEEP_MIN_MINUTES,
        DEFAULT_TARGET_DAY_SLEEP_MAX_MINUTES,
      ),
      bedtimeTargetMinutes = bedtimeTargetMinutes,
      earlyBedtimeMinutes = normalizeClockMinutes(bedtimeTargetMinutes - EARLY_BEDTIME_OFFSET_MINUTES),
      latestEveningNapEndMinutes = eveningRules.latestEveningNapEndMinutes,
      maxEveningNapMinutes = eveningRules.maxEveningNapMinutes,
      minNightSleepMinutes = DEFAULT_MIN_NIGHT_SLEEP_MINUTES,
      microNapMinutes = eveningRules.microNapMinutes,
    )
  }

  private fun upsertSleepDayPlanSnapshotsForSession(
    db: SQLiteDatabase,
    plan: SleepPlan,
    startedAtMillis: Long,
    endedAtMillis: Long?,
    nowMillis: Long,
    nowIso: String,
  ) {
    val currentSleepDayDate = getSleepDayDateKey(Date(nowMillis), plan)
    val sleepDayDates = getSleepDayDateKeysForInterval(startedAtMillis, endedAtMillis, plan)

    for (sleepDayDate in sleepDayDates) {
      if (!hasSleepDayPlanSnapshot(db, sleepDayDate) || sleepDayDate == currentSleepDayDate) {
        upsertSleepDayPlanSnapshot(db, plan, sleepDayDate, nowIso)
      }
    }
  }

  private fun hasSleepDayPlanSnapshot(db: SQLiteDatabase, sleepDayDate: String): Boolean {
    db.rawQuery(
      """
      SELECT 1
      FROM sleep_day_plan_snapshot
      WHERE child_id = ? AND sleep_day_date = ?
      LIMIT 1
      """.trimIndent(),
      arrayOf(DEFAULT_CHILD_ID, sleepDayDate),
    ).use { cursor ->
      return cursor.moveToFirst()
    }
  }

  private fun upsertSleepDayPlanSnapshot(
    db: SQLiteDatabase,
    plan: SleepPlan,
    sleepDayDate: String,
    nowIso: String,
  ) {
    db.execSQL(
      """
      INSERT INTO sleep_day_plan_snapshot (
        child_id,
        sleep_day_date,
        source_plan_id,
        source_plan_name,
        day_start_minutes,
        wake_up_start_minutes,
        wake_up_end_minutes,
        target_awake_min_minutes,
        target_awake_max_minutes,
        target_awake_minutes,
        nap_count,
        target_day_sleep_min_minutes,
        target_day_sleep_max_minutes,
        target_day_sleep_minutes,
        bedtime_target_minutes,
        early_bedtime_minutes,
        latest_evening_nap_end_minutes,
        max_evening_nap_minutes,
        min_night_sleep_minutes,
        micro_nap_minutes,
        captured_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(child_id, sleep_day_date) DO UPDATE SET
        source_plan_id = excluded.source_plan_id,
        source_plan_name = excluded.source_plan_name,
        day_start_minutes = excluded.day_start_minutes,
        wake_up_start_minutes = excluded.wake_up_start_minutes,
        wake_up_end_minutes = excluded.wake_up_end_minutes,
        target_awake_min_minutes = excluded.target_awake_min_minutes,
        target_awake_max_minutes = excluded.target_awake_max_minutes,
        target_awake_minutes = excluded.target_awake_minutes,
        nap_count = excluded.nap_count,
        target_day_sleep_min_minutes = excluded.target_day_sleep_min_minutes,
        target_day_sleep_max_minutes = excluded.target_day_sleep_max_minutes,
        target_day_sleep_minutes = excluded.target_day_sleep_minutes,
        bedtime_target_minutes = excluded.bedtime_target_minutes,
        early_bedtime_minutes = excluded.early_bedtime_minutes,
        latest_evening_nap_end_minutes = excluded.latest_evening_nap_end_minutes,
        max_evening_nap_minutes = excluded.max_evening_nap_minutes,
        min_night_sleep_minutes = excluded.min_night_sleep_minutes,
        micro_nap_minutes = excluded.micro_nap_minutes,
        updated_at = excluded.updated_at
      """.trimIndent(),
      arrayOf(
        DEFAULT_CHILD_ID,
        sleepDayDate,
        plan.sourcePlanId,
        plan.sourcePlanName,
        plan.dayStartMinutes,
        plan.wakeUpStartMinutes,
        plan.wakeUpEndMinutes,
        plan.targetAwakeMinMinutes,
        plan.targetAwakeMaxMinutes,
        plan.targetAwakeMinutes,
        plan.napCount,
        plan.targetDaySleepMinMinutes,
        plan.targetDaySleepMaxMinutes,
        plan.targetDaySleepMinutes,
        plan.bedtimeTargetMinutes,
        plan.earlyBedtimeMinutes,
        plan.latestEveningNapEndMinutes,
        plan.maxEveningNapMinutes,
        plan.minNightSleepMinutes,
        plan.microNapMinutes,
        nowIso,
        nowIso,
      ),
    )
  }

  private fun inferSleepKind(startedAtMillis: Long, endedAtMillis: Long?, plan: SleepPlan): String {
    val startMinutesFromMidnight = getMinutesFromMidnight(startedAtMillis)

    if (startMinutesFromMidnight < plan.dayStartMinutes) {
      return "night"
    }

    if (endedAtMillis == null) {
      return if (startMinutesFromMidnight >= plan.bedtimeTargetMinutes) "night" else "nap"
    }

    val endMinutesFromMidnight = getMinutesFromMidnight(endedAtMillis)
    val durationMinutes = max(
      0,
      ((endedAtMillis - startedAtMillis).toDouble() / 60_000.0).roundToInt(),
    )
    val crossesMidnight = getLocalDateKey(startedAtMillis) != getLocalDateKey(endedAtMillis)

    if (crossesMidnight || startMinutesFromMidnight >= plan.bedtimeTargetMinutes) {
      return "night"
    }

    if (startMinutesFromMidnight >= plan.earlyBedtimeMinutes) {
      val isShortEveningNap =
        durationMinutes <= plan.maxEveningNapMinutes &&
          endMinutesFromMidnight <= plan.latestEveningNapEndMinutes

      return if (isShortEveningNap) "nap" else "night"
    }

    if (
      durationMinutes >= plan.minNightSleepMinutes &&
      endMinutesFromMidnight >= plan.bedtimeTargetMinutes
    ) {
      return "night"
    }

    return "nap"
  }

  private fun getSleepDayDateKeysForInterval(
    startedAtMillis: Long,
    endedAtMillis: Long?,
    plan: SleepPlan,
  ): List<String> {
    val firstKey = getSleepDayDateKey(Date(startedAtMillis), plan)

    if (endedAtMillis == null || endedAtMillis <= startedAtMillis) {
      return listOf(firstKey)
    }

    val lastKey = getSleepDayDateKey(Date(endedAtMillis - 1L), plan)

    if (firstKey == lastKey) {
      return listOf(firstKey)
    }

    val keys = mutableListOf<String>()
    val calendar = calendarFromSleepDayKey(firstKey)
    val lastTime = calendarFromSleepDayKey(lastKey).timeInMillis

    while (calendar.timeInMillis <= lastTime) {
      keys.add(localDateFormatter.format(calendar.time))
      calendar.add(Calendar.DAY_OF_MONTH, 1)
    }

    return keys
  }

  private fun getSleepDayDateKey(date: Date, plan: SleepPlan): String {
    val calendar = Calendar.getInstance().apply {
      time = date
    }

    if (getMinutesFromMidnight(date.time) < plan.dayStartMinutes) {
      calendar.add(Calendar.DAY_OF_MONTH, -1)
    }

    return localDateFormatter.format(calendar.time)
  }

  private fun calendarFromSleepDayKey(key: String): Calendar {
    val parts = key.split("-").map { it.toInt() }

    return Calendar.getInstance().apply {
      clear()
      set(parts[0], parts[1] - 1, parts[2], 12, 0, 0)
    }
  }

  private fun createSleepSessionId(timestampMillis: Long): String {
    return "sleep-$timestampMillis-${UUID.randomUUID().toString().take(6)}"
  }

  private fun parseIso(value: String): Date? {
    return try {
      isoFormatter.parse(value)
    } catch (_: Exception) {
      null
    }
  }

  private fun formatIso(date: Date): String = isoFormatter.format(date)

  private fun getMinutesFromMidnight(timestampMillis: Long): Int {
    val calendar = Calendar.getInstance().apply {
      timeInMillis = timestampMillis
    }

    return calendar.get(Calendar.HOUR_OF_DAY) * 60 + calendar.get(Calendar.MINUTE)
  }

  private fun getLocalDateKey(timestampMillis: Long): String {
    return localDateFormatter.format(Date(timestampMillis))
  }

  private fun midpoint(first: Int, second: Int): Int {
    return ((first + second).toDouble() / 2.0).roundToInt()
  }

  private fun normalizeClockMinutes(minutes: Int): Int {
    return ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
  }

  private fun clampNapCount(napCount: Int): Int {
    return napCount.coerceIn(1, 5)
  }

  private fun deriveEveningRules(napCount: Int, bedtimeTargetMinutes: Int): EveningRules {
    val latestEndOffsetMinutes = when (clampNapCount(napCount)) {
      1 -> SINGLE_NAP_LATEST_END_BEFORE_BEDTIME_MINUTES
      2 -> TWO_NAP_LATEST_END_BEFORE_BEDTIME_MINUTES
      else -> MANY_NAP_LATEST_END_BEFORE_BEDTIME_MINUTES
    }
    val maxEveningNapMinutes = when (clampNapCount(napCount)) {
      1 -> SINGLE_NAP_MAX_EVENING_NAP_MINUTES
      2 -> TWO_NAP_MAX_EVENING_NAP_MINUTES
      else -> MANY_NAP_MAX_EVENING_NAP_MINUTES
    }
    val microNapMinutes = when (clampNapCount(napCount)) {
      1 -> SINGLE_NAP_MICRO_NAP_MINUTES
      2 -> TWO_NAP_MICRO_NAP_MINUTES
      else -> MANY_NAP_MICRO_NAP_MINUTES
    }

    return EveningRules(
      latestEveningNapEndMinutes = normalizeClockMinutes(
        bedtimeTargetMinutes - latestEndOffsetMinutes,
      ),
      maxEveningNapMinutes = maxEveningNapMinutes,
      microNapMinutes = microNapMinutes,
    )
  }
}

private data class EveningRules(
  val latestEveningNapEndMinutes: Int,
  val maxEveningNapMinutes: Int,
  val microNapMinutes: Int,
)

private fun Cursor.getStringOrNull(index: Int): String? {
  return if (isNull(index)) null else getString(index)
}

private fun Cursor.getIntOrDefault(index: Int, defaultValue: Int): Int {
  return if (isNull(index)) defaultValue else getInt(index)
}

private fun formatClock(timestampMillis: Long): String {
  val calendar = Calendar.getInstance().apply {
    timeInMillis = timestampMillis
  }
  val hours = calendar.get(Calendar.HOUR_OF_DAY).toString().padStart(2, '0')
  val minutes = calendar.get(Calendar.MINUTE).toString().padStart(2, '0')

  return "$hours:$minutes"
}
