# SolutionLab — Mobile

Voice-first civic platform for Uzbekistan: citizens report problems (by voice,
text, or photo), the community upvotes and discusses them in a live "solution
chat", and startups propose solutions. Companion app to the SolutionLab web +
FastAPI backend. All user-facing copy is in Uzbek.

## Stack

- **Flutter** (Dart SDK `>=3.5.0 <4.0.0`), Material 3.
- **State**: `flutter_riverpod` (codegen-free — `StateNotifier` / `AsyncNotifier` / `Provider`).
- **Navigation**: `go_router` with a `StatefulShellRoute` bottom-nav shell and an auth-gate redirect.
- **Networking**: `dio` (`ApiClient` with bearer auth, single-flight 401 refresh, forced-logout signal).
- **Secure storage**: `flutter_secure_storage` (auth tokens + app preferences).
- **Media**: `record` (voice capture), `just_audio` (playback), `image_picker` (photos), `cached_network_image` (avatars).
- **Misc**: `url_launcher` (Telegram deep links).

## Project structure

```
lib/
  main.dart                     App entry; primes TokenStorage, applies theme, mounts MaterialApp.router
  core/
    api_client.dart             Dio client + ApiException; apiClientProvider, tokenStorageProvider
    config.dart                 AppConfig (API base via --dart-define, poll intervals, page size)
    router.dart                 Routes constants + routerProvider (GoRouter) + auth-gate redirect
    storage.dart                TokenStorage (secure token cache)
    theme.dart                  AppTheme (light/dark), AppColors ThemeExtension, AppRole
  models/                       Manual fromJson/toJson models + barrel (models.dart) + J JSON helpers
    problem, comment, project, problem_media, sector, region,
    notification_item, analytics_overview, auth_models, paginated, json_utils
  shared/widgets/               Reusable UI: AppButton, RoleBadge, StatusChip, UserAvatar,
                                VoiceRecordButton (+ widgets.dart barrel)
  features/
    auth/                       Splash, Login, ConnectTelegram, TelegramLoginPanel,
                                AuthController (authControllerProvider), google_sign_in_stub
    shell/home_shell.dart       NavigationBar shell (Home / Notifications / Profile)
    problems/                   Feed (home_screen -> problems_feed_screen), ProblemCard,
                                ProblemDetailScreen (live chat), providers, chat/solution/composer/audio widgets
    submit/                     SubmitScreen (3-step), SubmitController, record/photo/option/result widgets
    notifications/              NotificationsScreen + NotificationsController
    profile/                    ProfileScreen, SettingsScreen, currentUserProvider, appSettingsProvider
```

### How it fits together

- `main()` primes `TokenStorage` before the first frame and overrides
  `tokenStorageProvider` with it. `SolutionLabApp` watches `routerProvider` and
  `appSettingsProvider` (theme mode).
- The **auth gate** lives in `router.dart`'s `redirect`: it reads
  `authControllerProvider` and routes `unknown→/splash`,
  `unauthenticated→/login`, `needsTelegramLink→/connect-telegram`, and bounces an
  authenticated user off the auth screens to `/home`. It re-runs whenever auth
  state changes. Screens never guard themselves.
- Logout (`AuthController.logout()`) clears tokens and flips state to
  `unauthenticated`, which the redirect turns into a `/login` navigation.

## Running it

Platform folders (`android/`, `ios/`) are committed. If they are ever missing or
out of date, regenerate the scaffolding without touching `lib/`:

```bash
flutter create .
```

Then:

```bash
flutter pub get
flutter analyze          # expect a clean tree
```

### Point the app at your backend

`AppConfig.apiBase` defaults to `http://10.0.2.2:8000` (the Android emulator's
loopback to the host). Override per target with `--dart-define`:

```bash
# Android emulator (default — host's localhost:8000)
flutter run

# iOS simulator (host is localhost)
flutter run --dart-define=API_BASE=http://localhost:8000

# Physical device on the same LAN
flutter run --dart-define=API_BASE=http://192.168.1.50:8000

# Staging / prod
flutter run --dart-define=API_BASE=https://api.your-domain.com
```

The client appends `/api/v1` automatically. Optional:
`--dart-define=GOOGLE_CLIENT_ID=<server-client-id>` (used as the ID-token
audience once Google Sign-In is wired up).

### Native permissions (already declared)

- **Android** (`android/app/src/main/AndroidManifest.xml`): `INTERNET`,
  `RECORD_AUDIO`, plus `<queries>` for `https` / `tg` so `url_launcher` can open
  Telegram on Android 11+.
- **iOS** (`ios/Runner/Info.plist`): `NSMicrophoneUsageDescription`,
  `NSPhotoLibraryUsageDescription`, `NSCameraUsageDescription`, and
  `LSApplicationQueriesSchemes` (`tg`, `https`).

`image_picker` does not require a separate Android `CAMERA` permission.

## Known gaps / next steps

1. **Google Sign-In is a stub.** `google_sign_in` is intentionally *not* in
   `pubspec.yaml` (needs per-platform OAuth client setup). The integration point
   is `lib/features/auth/google_sign_in_stub.dart` → `obtainGoogleCredential()`:
   in debug it opens a paste-token dialog; in release the button no-ops with a
   message. Add `google_sign_in`, configure the OAuth clients, and return the
   ID token (audience = `AppConfig.googleClientId`) to `loginWithGoogle`.
2. **Current user comes from the JWT.** There is no `/me` endpoint, so
   `currentUserProvider` / `currentUserIdProvider` decode the access-token claims
   best-effort. Point them at a real endpoint/model when available.
3. **Language switch persists but is not applied.** `appSettingsProvider` stores
   the chosen `AppLanguage`, but there is no string-localization layer yet (all
   copy is hardcoded Uzbek) and no `flutter_localizations`. Add gen-l10n +
   `localizationsDelegates` / `supportedLocales` and set `MaterialApp.locale`
   from `settings.locale` to make it functional. (Theme mode *is* wired.)
4. **Reference-data providers are duplicated.** `sectorsProvider` /
   `regionsProvider` exist in both `problems/problem_providers.dart` and
   `problems/providers/problems_providers.dart` (and `submit` has its own
   `submit*` variants). They don't collide (no single file imports two), but
   consolidating into one canonical pair would be cleaner.
5. **"Mening muammolarim"** (profile tile) currently routes to the feed; there's
   no dedicated mine-filtered route. The feed controller already supports a
   `mine` filter — expose a route/screen for it.
6. **No push notifications.** The inbox is pull-only (`GET /notifications`,
   single page, pull-to-refresh; problem-detail chat polls every 4s). Add FCM/APNs
   for real-time delivery and an unread badge on the nav bar.
7. **Waveform is amplitude-sampled**, not a true rendered waveform; the recorded
   file is written to `Directory.systemTemp` (no `path_provider` dependency).
8. **Chat media**: the composer's mic/camera buttons are informational only —
   comments are text-only per the model. Wire to `apiClient.uploadMedia` if
   comment attachments are added.
9. **Verify audio MIME**: recordings upload as `audio/mp4` (record's `aacLc`
   → `.m4a`). Confirm the backend/storage accepts it (`_audioContentType` in
   `submit_controller.dart`).
10. **Not run on a device** in this environment — analyzer-level review only.
    Do a real `flutter run` + smoke test of login → feed → submit → detail chat.
```
