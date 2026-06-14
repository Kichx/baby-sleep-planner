package notifications

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.math.max

class ActiveSleepChronometer : Module() {
  override fun definition() = ModuleDefinition {
    Name("ActiveSleepChronometer")

    Function("show") { startedAtMillis: Double, startedAtLabel: String ->
      val reactContext = appContext.reactContext ?: return@Function false
      val context = reactContext.applicationContext

      if (!canPostNotifications(context)) {
        return@Function false
      }

      return@Function try {
        val startedAtMillisLong = startedAtMillis.toLong()

        ActiveSleepNotificationService.showStatusNotification(
          context,
          startedAtMillisLong,
          startedAtLabel,
        )

        val intent = ActiveSleepNotificationService.createShowIntent(
          context,
          startedAtMillisLong,
          startedAtLabel,
        )

        try {
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ContextCompat.startForegroundService(context, intent)
          } else {
            context.startService(intent)
          }
        } catch (_: Exception) {
          // The status notification above is enough when foreground service startup is blocked.
        }

        true
      } catch (_: Exception) {
        false
      }
    }

    Function("hide") {
      val reactContext = appContext.reactContext ?: return@Function false
      val context = reactContext.applicationContext

      ActiveSleepNotificationService.cancelNotifications(context)

      try {
        context.startService(ActiveSleepNotificationService.createHideIntent(context))
      } catch (_: Exception) {
        // Canceling the notification above is enough if the service is not currently running.
      }

      return@Function true
    }
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
}

class ActiveSleepNotificationService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private var startedAtMillis: Long = 0L
  private var startedAtLabel: String = ""

  private val updateRunnable = object : Runnable {
    override fun run() {
      if (startedAtMillis <= 0L) {
        stopTracking()
        return
      }

      updateNotification()
      handler.postDelayed(this, getDelayUntilNextMinute())
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_HIDE) {
      stopTracking()
      return START_NOT_STICKY
    }

    val nextStartedAtMillis =
      intent?.getLongExtra(EXTRA_STARTED_AT_MILLIS, 0L)?.takeIf { it > 0L }
        ?: readStoredStartedAtMillis()
    val nextStartedAtLabel =
      intent?.getStringExtra(EXTRA_STARTED_AT_LABEL) ?: readStoredStartedAtLabel()

    if (nextStartedAtMillis <= 0L) {
      stopTracking()
      return START_NOT_STICKY
    }

    startedAtMillis = nextStartedAtMillis
    startedAtLabel = nextStartedAtLabel
    storeActiveSleep()

    try {
      ensureChannel(this)
      startActiveForeground()
      cancelLegacyNotification(this)
      scheduleNextUpdate()
    } catch (_: Exception) {
      showStatusNotificationFallback()
      stopTracking(cancelNotifications = false)
      return START_NOT_STICKY
    }

    return START_STICKY
  }

  override fun onDestroy() {
    handler.removeCallbacks(updateRunnable)
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun startActiveForeground() {
    val notification = buildNotification(this, startedAtMillis, startedAtLabel)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(
        NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE,
      )
      return
    }

    startForeground(NOTIFICATION_ID, notification)
  }

  private fun updateNotification() {
    try {
      val notification = buildNotification(this, startedAtMillis, startedAtLabel)
      NotificationManagerCompat.from(this).notify(NOTIFICATION_ID, notification)
    } catch (_: Exception) {
      stopTracking()
    }
  }

  private fun showStatusNotificationFallback() {
    try {
      showStatusNotification(this, startedAtMillis, startedAtLabel)
    } catch (_: Exception) {
      // If even a regular notification cannot be posted, sleep logging must stay unaffected.
    }
  }

  private fun scheduleNextUpdate() {
    handler.removeCallbacks(updateRunnable)
    handler.postDelayed(updateRunnable, getDelayUntilNextMinute())
  }

  private fun getDelayUntilNextMinute(): Long {
    val elapsedMillis = max(0L, System.currentTimeMillis() - startedAtMillis)
    return UPDATE_INTERVAL_MS - (elapsedMillis % UPDATE_INTERVAL_MS) + UPDATE_GRACE_MS
  }

  private fun stopTracking(cancelNotifications: Boolean = true) {
    startedAtMillis = 0L
    startedAtLabel = ""
    handler.removeCallbacks(updateRunnable)
    clearActiveSleep()
    if (cancelNotifications) {
      cancelNotifications(this)
    }

    if (cancelNotifications) {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        stopForeground(STOP_FOREGROUND_REMOVE)
      } else {
        @Suppress("DEPRECATION")
        stopForeground(true)
      }
    }

    stopSelf()
  }

  private fun storeActiveSleep() {
    getPreferences()
      .edit()
      .putLong(PREF_STARTED_AT_MILLIS, startedAtMillis)
      .putString(PREF_STARTED_AT_LABEL, startedAtLabel)
      .apply()
  }

  private fun clearActiveSleep() {
    getPreferences()
      .edit()
      .remove(PREF_STARTED_AT_MILLIS)
      .remove(PREF_STARTED_AT_LABEL)
      .apply()
  }

  private fun readStoredStartedAtMillis(): Long {
    return getPreferences().getLong(PREF_STARTED_AT_MILLIS, 0L)
  }

  private fun readStoredStartedAtLabel(): String {
    return getPreferences().getString(PREF_STARTED_AT_LABEL, "") ?: ""
  }

  private fun getPreferences() = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  companion object {
    private const val ACTION_SHOW = "notifications.ActiveSleepNotificationService.SHOW"
    private const val ACTION_HIDE = "notifications.ActiveSleepNotificationService.HIDE"
    private const val EXTRA_STARTED_AT_MILLIS = "startedAtMillis"
    private const val EXTRA_STARTED_AT_LABEL = "startedAtLabel"
    private const val PREFS_NAME = "active_sleep_notification"
    private const val PREF_STARTED_AT_MILLIS = "startedAtMillis"
    private const val PREF_STARTED_AT_LABEL = "startedAtLabel"
    private const val CHANNEL_ID = "active-sleep"
    private const val LEGACY_NOTIFICATION_TAG = "active-sleep-notification"
    private const val LEGACY_NOTIFICATION_ID = 0
    private const val NOTIFICATION_ID = 1001
    private const val UPDATE_INTERVAL_MS = 60_000L
    private const val UPDATE_GRACE_MS = 250L

    fun createShowIntent(
      context: Context,
      startedAtMillis: Long,
      startedAtLabel: String,
    ): Intent {
      return Intent(context, ActiveSleepNotificationService::class.java).apply {
        action = ACTION_SHOW
        putExtra(EXTRA_STARTED_AT_MILLIS, startedAtMillis)
        putExtra(EXTRA_STARTED_AT_LABEL, startedAtLabel)
      }
    }

    fun createHideIntent(context: Context): Intent {
      return Intent(context, ActiveSleepNotificationService::class.java).apply {
        action = ACTION_HIDE
      }
    }

    fun cancelNotifications(context: Context) {
      NotificationManagerCompat.from(context).apply {
        cancel(NOTIFICATION_ID)
        cancel(LEGACY_NOTIFICATION_TAG, LEGACY_NOTIFICATION_ID)
      }
    }

    fun showStatusNotification(
      context: Context,
      startedAtMillis: Long,
      startedAtLabel: String,
    ) {
      ensureChannel(context)
      val notification = buildNotification(context, startedAtMillis, startedAtLabel)
      NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
    }

    private fun cancelLegacyNotification(context: Context) {
      NotificationManagerCompat.from(context).cancel(
        LEGACY_NOTIFICATION_TAG,
        LEGACY_NOTIFICATION_ID,
      )
    }

    private fun buildNotification(
      context: Context,
      startedAtMillis: Long,
      startedAtLabel: String,
    ): Notification {
      val durationLabel = formatDuration(startedAtMillis)
      val builder = NotificationCompat.Builder(context, CHANNEL_ID)
        .setSmallIcon(getSmallIconResourceId(context))
        .setContentTitle("Сон идёт $durationLabel")
        .setContentText("Начало в $startedAtLabel")
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .setCategory(NotificationCompat.CATEGORY_STATUS)
        .setColor(Color.parseColor("#2F5D50"))
        .setOngoing(true)
        .setAutoCancel(false)
        .setWhen(startedAtMillis)
        .setShowWhen(true)
        .setUsesChronometer(true)
        .setChronometerCountDown(false)
        .setLocalOnly(true)
        .setSilent(true)
        .setOnlyAlertOnce(true)

      createLaunchIntent(context)?.let { launchIntent ->
        builder.setContentIntent(
          PendingIntent.getActivity(
            context,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
          ),
        )
      }

      return builder.build()
    }

    private fun formatDuration(startedAtMillis: Long): String {
      val elapsedMinutes = max(
        0L,
        (System.currentTimeMillis() - startedAtMillis) / UPDATE_INTERVAL_MS,
      )
      val hours = elapsedMinutes / 60L
      val minutes = elapsedMinutes % 60L

      if (hours <= 0L) {
        return "$minutes мин"
      }

      if (minutes <= 0L) {
        return "$hours ч"
      }

      return "$hours ч ${minutes.toString().padStart(2, '0')} мин"
    }

    private fun ensureChannel(context: Context) {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        return
      }

      val notificationManager =
        context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      val existingChannel = notificationManager.getNotificationChannel(CHANNEL_ID)

      if (existingChannel != null) {
        return
      }

      val channel = NotificationChannel(
        CHANNEL_ID,
        "Идущий сон",
        NotificationManager.IMPORTANCE_LOW,
      ).apply {
        description = "Показывает активный сон и текущую длительность."
        enableLights(false)
        enableVibration(false)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        setShowBadge(false)
        setSound(null, null)
      }

      notificationManager.createNotificationChannel(channel)
    }

    private fun createLaunchIntent(context: Context): Intent? {
      return context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
        flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
      }
    }

    private fun getSmallIconResourceId(context: Context): Int {
      val notificationIconId = context.resources.getIdentifier(
        "notification_icon",
        "drawable",
        context.packageName,
      )

      if (notificationIconId != 0) {
        return notificationIconId
      }

      if (context.applicationInfo.icon != 0) {
        return context.applicationInfo.icon
      }

      return android.R.drawable.ic_lock_idle_alarm
    }
  }
}
