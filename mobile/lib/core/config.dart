/// App-wide configuration and constants.
///
/// [AppConfig.apiBase] can be overridden at build time:
///   flutter run --dart-define=API_BASE=https://api.example.com
class AppConfig {
  AppConfig._();

  /// Base host (no trailing slash, no /api/v1).
  /// Default targets the Android emulator loopback to the host machine.
  static const String apiBase = String.fromEnvironment(
    'API_BASE',
    defaultValue: 'http://10.0.2.2:8000',
  );

  /// Full API prefix used by [ApiClient].
  static String get apiV1 => '$apiBase/api/v1';

  /// Google OAuth client id (web/server id token audience), overridable.
  static const String googleClientId = String.fromEnvironment(
    'GOOGLE_CLIENT_ID',
    defaultValue: '',
  );

  // ---- Behaviour tuning -------------------------------------------------

  /// How often the Telegram login status is polled.
  static const Duration telegramPollInterval = Duration(seconds: 2);

  /// How long to keep polling the Telegram login status before giving up.
  static const Duration telegramPollTimeout = Duration(minutes: 3);

  /// Live-chat auto refresh interval on the problem detail screen.
  static const Duration chatRefreshInterval = Duration(seconds: 4);

  /// Default page size for paginated lists.
  static const int pageSize = 20;

  /// Network timeouts.
  static const Duration connectTimeout = Duration(seconds: 20);
  static const Duration receiveTimeout = Duration(seconds: 30);
}
