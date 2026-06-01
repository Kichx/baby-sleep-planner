package notifications

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ActiveSleepChronometer : Module() {
  override fun definition() = ModuleDefinition {
    Name("ActiveSleepChronometer")

    Function("show") { startedAtMillis: Double, startedAtLabel: String ->
      val reactContext = appContext.reactContext ?: return@Function false
      val context = reactContext.applicationContext

      if (!canPostNotifications(context)) {
        return@Function false
      }

      ensureChannel(context)

      val builder = NotificationCompat.Builder(context, CHANNEL_ID)
        .setSmallIcon(getSmallIconResourceId(context))
        .setContentTitle("Сон идёт")
        .setContentText("Начало в $startedAtLabel")
        .setSubText("Режимка")
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .setCategory(NotificationCompat.CATEGORY_STATUS)
        .setColor(Color.parseColor("#2F5D50"))
        .setOngoing(true)
        .setAutoCancel(false)
        .setLocalOnly(true)
        .setSilent(true)
        .setShowWhen(true)
        .setWhen(startedAtMillis.toLong())
        .setUsesChronometer(true)
        .setChronometerCountDown(false)

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

      NotificationManagerCompat.from(context).notify(
        NOTIFICATION_TAG,
        NOTIFICATION_ID,
        builder.build(),
      )

      return@Function true
    }

    Function("hide") {
      val reactContext = appContext.reactContext ?: return@Function false
      val context = reactContext.applicationContext

      NotificationManagerCompat.from(context).cancel(NOTIFICATION_TAG, NOTIFICATION_ID)

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
      description = "Показывает активный сон и системный счётчик длительности."
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

  private companion object {
    const val CHANNEL_ID = "active-sleep"
    const val NOTIFICATION_TAG = "active-sleep-notification"
    const val NOTIFICATION_ID = 0
  }
}
