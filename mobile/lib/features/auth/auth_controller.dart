import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../core/storage.dart';
import '../../models/auth_models.dart';

/// High-level authentication state used by the router redirect gate.
enum AuthStatus {
  /// Startup — tokens not yet checked.
  unknown,

  /// Logged in and fully usable.
  authenticated,

  /// Logged in via Google but Telegram not yet linked; app is gated until
  /// the user links Telegram.
  needsTelegramLink,

  /// No valid session.
  unauthenticated,
}

class AuthState {
  const AuthState({required this.status, this.error});

  final AuthStatus status;
  final String? error;

  bool get isAuthenticated => status == AuthStatus.authenticated;

  AuthState copyWith({AuthStatus? status, String? error}) =>
      AuthState(status: status ?? this.status, error: error);
}

class AuthController extends StateNotifier<AuthState> {
  AuthController(Ref ref)
      : _api = ref.read(apiClientProvider),
        _storage = ref.read(tokenStorageProvider),
        super(const AuthState(status: AuthStatus.unknown)) {
    // Wire the API client's forced-logout signal back into auth state.
    _api.onSessionExpired = _onSessionExpired;
    _bootstrap();
  }

  final ApiClient _api;
  final TokenStorage _storage;

  void _bootstrap() {
    state = AuthState(
      status: _storage.hasSession
          ? AuthStatus.authenticated
          : AuthStatus.unauthenticated,
    );
  }

  void _onSessionExpired() {
    state = const AuthState(status: AuthStatus.unauthenticated);
  }

  // ---- Telegram flow ----------------------------------------------------

  Future<TelegramStartResult> startTelegramLogin(String phone) async {
    final json = await _api.postJson('/auth/telegram/start', body: {
      'phone': phone,
      'client': 'mobile',
    });
    return TelegramStartResult.fromJson(json);
  }

  /// Polls the login status once. If verified with tokens, persists them and
  /// flips state to authenticated.
  Future<TelegramStatusResult> pollTelegramStatus(String sessionId) async {
    final json = await _api.getJson('/auth/telegram/status/$sessionId');
    final result = TelegramStatusResult.fromJson(json);
    if (result.status == TelegramLoginStatus.verified && result.hasTokens) {
      await _storage.saveTokens(
        accessToken: result.accessToken!,
        refreshToken: result.refreshToken!,
      );
      state = const AuthState(status: AuthStatus.authenticated);
    }
    return result;
  }

  // ---- Google flow ------------------------------------------------------

  /// Verifies a Google ID token. Returns whether Telegram is already linked.
  /// If not linked, state becomes [AuthStatus.needsTelegramLink].
  Future<bool> loginWithGoogle(String credential) async {
    final json = await _api.postJson('/auth/google/verify', body: {
      'credential': credential,
    });
    final res = GoogleVerifyResult.fromJson(json);
    await _storage.saveTokens(
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
    );
    state = AuthState(
      status: res.telegramLinked
          ? AuthStatus.authenticated
          : AuthStatus.needsTelegramLink,
    );
    return res.telegramLinked;
  }

  /// Called after the user links Telegram from the connect screen.
  void markTelegramLinked() {
    if (_storage.hasSession) {
      state = const AuthState(status: AuthStatus.authenticated);
    }
  }

  // ---- Logout -----------------------------------------------------------

  Future<void> logout() async {
    final refresh = _storage.refreshToken;
    if (refresh != null && refresh.isNotEmpty) {
      try {
        await _api.postJson('/auth/telegram/logout',
            body: {'refresh_token': refresh});
      } catch (_) {
        // best effort
      }
    }
    await _storage.clear();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }
}

final authControllerProvider =
    StateNotifierProvider<AuthController, AuthState>((ref) {
  return AuthController(ref);
});
