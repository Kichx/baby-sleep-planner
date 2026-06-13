# RuStore AAB release

Подготовка рассчитана на публикацию Android App Bundle через EAS Build.

## Локальные файлы

Эти файлы создаются локально и не должны попадать в git:

- `credentials.json` - ключ загрузки для подписи AAB в EAS;
- `secrets/rustore/rustore-app-signing.jks` - ключ подписи приложения для RuStore;
- `secrets/rustore/rustore-upload.jks` - ключ загрузки для подписи AAB;
- `secrets/rustore/rustore-upload-cert.pem` - сертификат ключа загрузки для RuStore;
- `secrets/rustore/passwords.txt` - локальная памятка с паролями.

Если приложение уже публиковалось как APK, ключ подписи приложения должен совпадать со старым APK. В таком случае не используйте новый `rustore-app-signing.jks`, а подготовьте PEPK-архив из старого release-keystore.

## Сборка AAB

Профиль EAS:

```bash
npm run eas:build:android:rustore-aab
```

Фоновая сборка без ожидания:

```bash
npm run eas:build:android:rustore-aab:no-wait
```

Профиль `rustore-aab` собирает `.aab`, использует `credentialsSource: "local"` и подписывает bundle ключом загрузки из `credentials.json`.

## Что загрузить в RuStore

В RuStore Console при первой загрузке AAB нужно загрузить подпись приложения:

1. Скачайте `pepk.jar` и команду PEPK из окна RuStore Console.
2. В команде PEPK используйте:
   - keystore: `secrets/rustore/rustore-app-signing.jks`;
   - alias: `app-signing`;
   - output: например `secrets/rustore/pepk_out.zip`.
3. Загрузите в RuStore:
   - ZIP из PEPK, например `secrets/rustore/pepk_out.zip`;
   - PEM-сертификат `secrets/rustore/rustore-upload-cert.pem`.
4. Соберите AAB через EAS и загрузите полученный `.aab` в версию приложения.

Пароли находятся только в локальном `secrets/rustore/passwords.txt` и в `credentials.json`. Их нужно сохранить в надежном внешнем месте.
