const {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
} = require('expo/config-plugins');

const pkg = require('../package.json');

const SERVICE_NAME = 'notifications.ActiveSleepNotificationService';
const SPECIAL_USE_PROPERTY_NAME = 'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE';
const SPECIAL_USE_PROPERTY_VALUE = 'active_sleep_timer';

const FOREGROUND_SERVICE_PERMISSIONS = [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
];

function ensureActiveSleepService(androidManifest) {
  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
  application.service = application.service || [];

  let service = application.service.find(
    (item) => item.$?.['android:name'] === SERVICE_NAME,
  );

  if (!service) {
    service = {
      $: {
        'android:name': SERVICE_NAME,
      },
    };
    application.service.push(service);
  }

  service.$ = {
    ...service.$,
    'android:name': SERVICE_NAME,
    'android:exported': 'false',
    'android:foregroundServiceType': 'specialUse',
  };

  service.property = service.property || [];

  if (
    !service.property.some(
      (item) => item.$?.['android:name'] === SPECIAL_USE_PROPERTY_NAME,
    )
  ) {
    service.property.push({
      $: {
        'android:name': SPECIAL_USE_PROPERTY_NAME,
        'android:value': SPECIAL_USE_PROPERTY_VALUE,
      },
    });
  }
}

function withActiveSleepNotificationService(config) {
  return withAndroidManifest(config, (config) => {
    AndroidConfig.Permissions.ensurePermissions(
      config.modResults,
      FOREGROUND_SERVICE_PERMISSIONS,
    );
    ensureActiveSleepService(config.modResults);

    return config;
  });
}

module.exports = createRunOncePlugin(
  withActiveSleepNotificationService,
  'with-active-sleep-notification-service',
  pkg.version,
);
