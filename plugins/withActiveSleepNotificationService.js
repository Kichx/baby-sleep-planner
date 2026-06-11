const {
  AndroidConfig,
  createRunOncePlugin,
  withDangerousMod,
  withAndroidManifest,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const pkg = require('../package.json');

const SERVICE_NAME = 'notifications.ActiveSleepNotificationService';
const WIDGET_RECEIVER_NAME = 'widgets.SleepToggleWidgetProvider';
const SPECIAL_USE_PROPERTY_NAME = 'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE';
const SPECIAL_USE_PROPERTY_VALUE = 'active_sleep_timer';
const ANDROID_WIDGET_RESOURCES = [
  ['native/android/res/drawable/sleep_toggle_widget_background.xml', 'app/src/main/res/drawable/sleep_toggle_widget_background.xml'],
  ['native/android/res/drawable/sleep_toggle_widget_button.xml', 'app/src/main/res/drawable/sleep_toggle_widget_button.xml'],
  ['native/android/res/layout/sleep_toggle_widget.xml', 'app/src/main/res/layout/sleep_toggle_widget.xml'],
  ['native/android/res/xml/sleep_toggle_widget_info.xml', 'app/src/main/res/xml/sleep_toggle_widget_info.xml'],
];

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

function upsertAction(intentFilter, actionName) {
  intentFilter.action = intentFilter.action || [];

  if (
    !intentFilter.action.some((item) => item.$?.['android:name'] === actionName)
  ) {
    intentFilter.action.push({
      $: {
        'android:name': actionName,
      },
    });
  }
}

function upsertMetaData(component, name, resource) {
  component['meta-data'] = component['meta-data'] || [];

  let metaData = component['meta-data'].find(
    (item) => item.$?.['android:name'] === name,
  );

  if (!metaData) {
    metaData = {
      $: {
        'android:name': name,
      },
    };
    component['meta-data'].push(metaData);
  }

  metaData.$ = {
    ...metaData.$,
    'android:name': name,
    'android:resource': resource,
  };
}

function ensureSleepToggleWidgetReceiver(androidManifest) {
  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
  application.receiver = application.receiver || [];

  let receiver = application.receiver.find(
    (item) => item.$?.['android:name'] === WIDGET_RECEIVER_NAME,
  );

  if (!receiver) {
    receiver = {
      $: {
        'android:name': WIDGET_RECEIVER_NAME,
      },
    };
    application.receiver.push(receiver);
  }

  receiver.$ = {
    ...receiver.$,
    'android:name': WIDGET_RECEIVER_NAME,
    'android:exported': 'false',
  };
  receiver['intent-filter'] = receiver['intent-filter'] || [{}];
  upsertAction(receiver['intent-filter'][0], 'android.appwidget.action.APPWIDGET_UPDATE');
  upsertMetaData(receiver, 'android.appwidget.provider', '@xml/sleep_toggle_widget_info');
}

function copyAndroidWidgetResources(projectRoot, platformProjectRoot) {
  for (const [sourceRelativePath, targetRelativePath] of ANDROID_WIDGET_RESOURCES) {
    const sourcePath = path.join(projectRoot, sourceRelativePath);
    const targetPath = path.join(platformProjectRoot, targetRelativePath);

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
  }
}

function withActiveSleepNotificationService(config) {
  const configWithManifest = withAndroidManifest(config, (config) => {
    AndroidConfig.Permissions.ensurePermissions(
      config.modResults,
      FOREGROUND_SERVICE_PERMISSIONS,
    );
    ensureActiveSleepService(config.modResults);
    ensureSleepToggleWidgetReceiver(config.modResults);

    return config;
  });

  return withDangerousMod(configWithManifest, [
    'android',
    (config) => {
      copyAndroidWidgetResources(
        config.modRequest.projectRoot,
        config.modRequest.platformProjectRoot,
      );

      return config;
    },
  ]);
}

module.exports = createRunOncePlugin(
  withActiveSleepNotificationService,
  'with-active-sleep-notification-service',
  pkg.version,
);
