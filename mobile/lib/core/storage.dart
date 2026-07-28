import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Thin wrapper around [FlutterSecureStorage] for auth tokens.
///
/// A single instance is exposed application-wide via [tokenStorageProvider]
/// (see `core/api_client.dart`).
class TokenStorage {
  TokenStorage([FlutterSecureStorage? storage])
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
              iOptions: IOSOptions(
                accessibility: KeychainAccessibility.first_unlock,
              ),
            );

  final FlutterSecureStorage _storage;

  static const _kAccess = 'sl_access_token';
  static const _kRefresh = 'sl_refresh_token';

  // In-memory cache so the hot path (attaching Bearer header) is synchronous
  // after the first read.
  String? _accessCache;
  String? _refreshCache;
  bool _primed = false;

  /// Load tokens from disk once at startup.
  Future<void> prime() async {
    _accessCache = await _storage.read(key: _kAccess);
    _refreshCache = await _storage.read(key: _kRefresh);
    _primed = true;
  }

  bool get isPrimed => _primed;

  String? get accessToken => _accessCache;
  String? get refreshToken => _refreshCache;

  bool get hasSession =>
      (_accessCache != null && _accessCache!.isNotEmpty) &&
      (_refreshCache != null && _refreshCache!.isNotEmpty);

  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    _accessCache = accessToken;
    _refreshCache = refreshToken;
    await _storage.write(key: _kAccess, value: accessToken);
    await _storage.write(key: _kRefresh, value: refreshToken);
  }

  Future<void> updateAccess(String accessToken, String refreshToken) async {
    _accessCache = accessToken;
    _refreshCache = refreshToken;
    await _storage.write(key: _kAccess, value: accessToken);
    await _storage.write(key: _kRefresh, value: refreshToken);
  }

  Future<void> clear() async {
    _accessCache = null;
    _refreshCache = null;
    await _storage.delete(key: _kAccess);
    await _storage.delete(key: _kRefresh);
  }
}
