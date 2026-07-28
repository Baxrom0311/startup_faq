import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Supported UI languages. Uzbek is the default / first-class language.
enum AppLanguage {
  uz,
  ru,
  en;

  String get code => switch (this) {
        AppLanguage.uz => 'uz',
        AppLanguage.ru => 'ru',
        AppLanguage.en => 'en',
      };

  /// Name shown to the user, written in its own language.
  String get nativeLabel => switch (this) {
        AppLanguage.uz => "O'zbekcha",
        AppLanguage.ru => 'Русский',
        AppLanguage.en => 'English',
      };

  String get flag => switch (this) {
        AppLanguage.uz => '🇺🇿',
        AppLanguage.ru => '🇷🇺',
        AppLanguage.en => '🇬🇧',
      };

  Locale get locale => Locale(code);

  static AppLanguage fromCode(String? code) => AppLanguage.values.firstWhere(
        (l) => l.code == code,
        orElse: () => AppLanguage.uz,
      );
}

/// Immutable snapshot of user-facing app preferences.
@immutable
class AppSettings {
  const AppSettings({
    this.themeMode = ThemeMode.system,
    this.language = AppLanguage.uz,
  });

  final ThemeMode themeMode;
  final AppLanguage language;

  Locale get locale => language.locale;

  AppSettings copyWith({ThemeMode? themeMode, AppLanguage? language}) =>
      AppSettings(
        themeMode: themeMode ?? this.themeMode,
        language: language ?? this.language,
      );
}

/// Persists + exposes app preferences (theme mode, language).
///
/// Defaults are applied immediately; the persisted values are loaded
/// asynchronously and applied once available (a brief flash on cold start is
/// acceptable). Persistence uses [FlutterSecureStorage] since it is already a
/// project dependency — no extra package is required.
class AppSettingsController extends StateNotifier<AppSettings> {
  AppSettingsController([FlutterSecureStorage? storage])
      : _storage = storage ?? const FlutterSecureStorage(),
        super(const AppSettings()) {
    _load();
  }

  final FlutterSecureStorage _storage;

  static const _kThemeMode = 'sl_theme_mode';
  static const _kLanguage = 'sl_language';

  Future<void> _load() async {
    try {
      final theme = await _storage.read(key: _kThemeMode);
      final lang = await _storage.read(key: _kLanguage);
      state = state.copyWith(
        themeMode: _themeFromString(theme),
        language: lang == null ? null : AppLanguage.fromCode(lang),
      );
    } catch (_) {
      // Ignore — keep defaults if storage is unavailable.
    }
  }

  Future<void> setThemeMode(ThemeMode mode) async {
    if (mode == state.themeMode) return;
    state = state.copyWith(themeMode: mode);
    try {
      await _storage.write(key: _kThemeMode, value: _themeToString(mode));
    } catch (_) {}
  }

  Future<void> setLanguage(AppLanguage language) async {
    if (language == state.language) return;
    state = state.copyWith(language: language);
    try {
      await _storage.write(key: _kLanguage, value: language.code);
    } catch (_) {}
  }

  static ThemeMode _themeFromString(String? v) => switch (v) {
        'light' => ThemeMode.light,
        'dark' => ThemeMode.dark,
        _ => ThemeMode.system,
      };

  static String _themeToString(ThemeMode m) => switch (m) {
        ThemeMode.light => 'light',
        ThemeMode.dark => 'dark',
        ThemeMode.system => 'system',
      };
}

/// App-wide preference state. Watch this from `main.dart`'s `MaterialApp.router`
/// to drive `themeMode` and `locale` (integration step — see feature summary).
final appSettingsProvider =
    StateNotifierProvider<AppSettingsController, AppSettings>(
  (ref) => AppSettingsController(),
);
