import 'json_utils.dart';

/// Response of POST /auth/telegram/start.
class TelegramStartResult {
  const TelegramStartResult({
    required this.sessionId,
    required this.deepLink,
    required this.expiresAt,
  });

  final String sessionId;
  final String deepLink;
  final String expiresAt;

  factory TelegramStartResult.fromJson(Map<String, dynamic> j) =>
      TelegramStartResult(
        sessionId: J.str(j['session_id']),
        deepLink: J.str(j['deep_link']),
        expiresAt: J.str(j['expires_at']),
      );
}

/// Status values returned by GET /auth/telegram/status/{session_id}.
enum TelegramLoginStatus {
  pending,
  usedStart,
  verified,
  expired,
  phoneMismatch,
  timedOut,
  unknown;

  static TelegramLoginStatus parse(String s) => switch (s) {
        'pending' => TelegramLoginStatus.pending,
        'used_start' => TelegramLoginStatus.usedStart,
        'verified' => TelegramLoginStatus.verified,
        'expired' => TelegramLoginStatus.expired,
        'phone_mismatch' => TelegramLoginStatus.phoneMismatch,
        'timed_out' => TelegramLoginStatus.timedOut,
        _ => TelegramLoginStatus.unknown,
      };

  bool get isTerminal =>
      this == verified ||
      this == expired ||
      this == phoneMismatch ||
      this == timedOut;
}

/// Response of GET /auth/telegram/status/{session_id}.
class TelegramStatusResult {
  const TelegramStatusResult({
    required this.status,
    this.accessToken,
    this.refreshToken,
  });

  final TelegramLoginStatus status;
  final String? accessToken;
  final String? refreshToken;

  bool get hasTokens =>
      accessToken != null &&
      accessToken!.isNotEmpty &&
      refreshToken != null &&
      refreshToken!.isNotEmpty;

  factory TelegramStatusResult.fromJson(Map<String, dynamic> j) =>
      TelegramStatusResult(
        status: TelegramLoginStatus.parse(J.str(j['status'])),
        accessToken: J.strOrNull(j['access_token']),
        refreshToken: J.strOrNull(j['refresh_token']),
      );
}

/// Response of POST /auth/google/verify.
class GoogleVerifyResult {
  const GoogleVerifyResult({
    required this.accessToken,
    required this.refreshToken,
    required this.telegramLinked,
  });

  final String accessToken;
  final String refreshToken;
  final bool telegramLinked;

  factory GoogleVerifyResult.fromJson(Map<String, dynamic> j) =>
      GoogleVerifyResult(
        accessToken: J.str(j['access_token']),
        refreshToken: J.str(j['refresh_token']),
        telegramLinked: J.boolv(j['telegram_linked']),
      );
}

/// Response of POST /auth/telegram/refresh.
class TokenPair {
  const TokenPair({required this.accessToken, required this.refreshToken});

  final String accessToken;
  final String refreshToken;

  factory TokenPair.fromJson(Map<String, dynamic> j) => TokenPair(
        accessToken: J.str(j['access_token']),
        refreshToken: J.str(j['refresh_token']),
      );
}

/// Result of a media presign request (POST /media/presign).
class PresignResult {
  const PresignResult({
    required this.uploadUrl,
    required this.objectKey,
    required this.method,
  });

  final String uploadUrl;
  final String objectKey;
  final String method;

  factory PresignResult.fromJson(Map<String, dynamic> j) => PresignResult(
        uploadUrl: J.str(j['upload_url']),
        objectKey: J.str(j['object_key']),
        method: J.str(j['method'], 'PUT'),
      );
}
