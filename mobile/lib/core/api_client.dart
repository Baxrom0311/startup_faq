import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'config.dart';
import 'storage.dart';
import '../models/auth_models.dart';

/// Normalized API error surfaced to the UI layer.
class ApiException implements Exception {
  ApiException(this.message, {this.statusCode, this.data});

  final String message;
  final int? statusCode;
  final dynamic data;

  bool get isUnauthorized => statusCode == 401;
  bool get isNotFound => statusCode == 404;

  @override
  String toString() => 'ApiException($statusCode): $message';
}

/// Central HTTP client.
///
/// Responsibilities:
///  * attach `Authorization: Bearer <access>` on every request,
///  * on a 401, refresh the token once via `/auth/telegram/refresh`, retry,
///    and if that fails clear tokens + fire [onSessionExpired],
///  * typed helpers [getJson] / [postJson] / [patchJson] / [delete],
///  * media presign + raw PUT upload.
class ApiClient {
  ApiClient(this._storage) {
    _dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.apiV1,
        connectTimeout: AppConfig.connectTimeout,
        receiveTimeout: AppConfig.receiveTimeout,
        contentType: Headers.jsonContentType,
        // We inspect statuses ourselves so refresh logic can run.
        validateStatus: (s) => s != null && s < 500,
      ),
    );

    // A separate Dio without the auth interceptor for refresh + raw uploads,
    // so we never recurse into the 401 handler.
    _bare = Dio(
      BaseOptions(
        connectTimeout: AppConfig.connectTimeout,
        receiveTimeout: AppConfig.receiveTimeout,
      ),
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          final token = _storage.accessToken;
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onResponse: (response, handler) async {
          if (response.statusCode == 401 && !_isAuthPath(response.requestOptions.path)) {
            final retried = await _handle401(response.requestOptions);
            if (retried != null) {
              return handler.resolve(retried);
            }
          }
          handler.next(response);
        },
      ),
    );
  }

  late final Dio _dio;
  late final Dio _bare;
  final TokenStorage _storage;

  /// Fired when refresh fails and the user must be logged out.
  void Function()? onSessionExpired;

  Dio get raw => _dio;

  bool _isAuthPath(String path) =>
      path.contains('/auth/telegram/refresh') ||
      path.contains('/auth/telegram/logout');

  // ---- 401 refresh handling --------------------------------------------

  Completer<bool>? _refreshInFlight;

  Future<Response<dynamic>?> _handle401(RequestOptions failed) async {
    final ok = await _refreshToken();
    if (!ok) return null;

    // Retry the original request once with the new access token.
    final token = _storage.accessToken;
    final opts = Options(
      method: failed.method,
      headers: {
        ...failed.headers,
        if (token != null) 'Authorization': 'Bearer $token',
      },
      contentType: failed.contentType,
      responseType: failed.responseType,
    );
    try {
      final retry = await _dio.request<dynamic>(
        failed.path,
        data: failed.data,
        queryParameters: failed.queryParameters,
        options: opts,
      );
      return retry;
    } catch (_) {
      return null;
    }
  }

  /// Refresh once, coalescing concurrent callers onto one in-flight refresh.
  Future<bool> _refreshToken() {
    final existing = _refreshInFlight;
    if (existing != null) return existing.future;

    final completer = Completer<bool>();
    _refreshInFlight = completer;

    _doRefresh().then((ok) {
      _refreshInFlight = null;
      completer.complete(ok);
    }).catchError((_) {
      _refreshInFlight = null;
      completer.complete(false);
    });

    return completer.future;
  }

  Future<bool> _doRefresh() async {
    final refresh = _storage.refreshToken;
    if (refresh == null || refresh.isEmpty) {
      await _forceLogout();
      return false;
    }
    try {
      final res = await _bare.post<dynamic>(
        '${AppConfig.apiV1}/auth/telegram/refresh',
        data: {'refresh_token': refresh},
        options: Options(contentType: Headers.jsonContentType),
      );
      if (res.statusCode == 200 && res.data is Map) {
        final pair = TokenPair.fromJson(Map<String, dynamic>.from(res.data));
        await _storage.updateAccess(pair.accessToken, pair.refreshToken);
        return true;
      }
    } catch (_) {
      // fall through to logout
    }
    await _forceLogout();
    return false;
  }

  Future<void> _forceLogout() async {
    await _storage.clear();
    onSessionExpired?.call();
  }

  // ---- Typed helpers ----------------------------------------------------

  Future<Map<String, dynamic>> getJson(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    final res = await _guard(() => _dio.get<dynamic>(path, queryParameters: query));
    return _asMap(res);
  }

  Future<Map<String, dynamic>> postJson(
    String path, {
    Object? body,
    Map<String, dynamic>? query,
  }) async {
    final res = await _guard(
      () => _dio.post<dynamic>(path, data: body, queryParameters: query),
    );
    return _asMap(res);
  }

  Future<Map<String, dynamic>> patchJson(
    String path, {
    Object? body,
  }) async {
    final res = await _guard(() => _dio.patch<dynamic>(path, data: body));
    return _asMap(res);
  }

  Future<Map<String, dynamic>> putJson(
    String path, {
    Object? body,
  }) async {
    final res = await _guard(() => _dio.put<dynamic>(path, data: body));
    return _asMap(res);
  }

  /// For endpoints that return 204 / no meaningful body (e.g. vote).
  Future<void> send(
    String method,
    String path, {
    Object? body,
  }) async {
    await _guard(
      () => _dio.request<dynamic>(
        path,
        data: body,
        options: Options(method: method),
      ),
    );
  }

  Future<void> delete(String path, {Object? body}) =>
      send('DELETE', path, body: body);

  // ---- Media ------------------------------------------------------------

  /// Presign then PUT the raw [bytes] to object storage.
  /// Returns the `object_key` to reference in problem payloads.
  Future<String> uploadMedia({
    required String kind, // "audio" | "photo"
    required String contentType,
    required Uint8List bytes,
  }) async {
    final presignRes = await postJson('/media/presign', body: {
      'kind': kind,
      'content_type': contentType,
      'size': bytes.length,
    });
    final presign = PresignResult.fromJson(presignRes);

    final put = await _bare.request<dynamic>(
      presign.uploadUrl,
      data: Stream.fromIterable([bytes]),
      options: Options(
        method: presign.method,
        headers: {
          'Content-Type': contentType,
          Headers.contentLengthHeader: bytes.length,
        },
      ),
    );
    final code = put.statusCode ?? 0;
    if (code < 200 || code >= 300) {
      throw ApiException('Media yuklashda xatolik', statusCode: code);
    }
    return presign.objectKey;
  }

  /// Convenience: upload a local file by path.
  Future<String> uploadFile({
    required String kind,
    required String contentType,
    required File file,
  }) async {
    final bytes = await file.readAsBytes();
    return uploadMedia(kind: kind, contentType: contentType, bytes: bytes);
  }

  // ---- internals --------------------------------------------------------

  Future<Response<dynamic>> _guard(
    Future<Response<dynamic>> Function() run,
  ) async {
    try {
      final res = await run();
      final code = res.statusCode ?? 0;
      if (code >= 200 && code < 300) return res;
      throw ApiException(
        _messageFrom(res.data) ?? 'Xatolik yuz berdi',
        statusCode: code,
        data: res.data,
      );
    } on DioException catch (e) {
      if (e.error is ApiException) throw e.error as ApiException;
      throw ApiException(
        e.message ?? 'Tarmoq xatosi',
        statusCode: e.response?.statusCode,
        data: e.response?.data,
      );
    }
  }

  Map<String, dynamic> _asMap(Response<dynamic> res) {
    final data = res.data;
    if (data is Map) return Map<String, dynamic>.from(data);
    return <String, dynamic>{};
  }

  String? _messageFrom(dynamic data) {
    if (data is Map) {
      final detail = data['detail'] ?? data['message'] ?? data['error'];
      if (detail is String) return detail;
      if (detail is List && detail.isNotEmpty) {
        final first = detail.first;
        if (first is Map && first['msg'] != null) return first['msg'].toString();
      }
    }
    return null;
  }
}

// ---- Providers ----------------------------------------------------------

/// Single [TokenStorage] instance for the app. It is primed in `main()`.
final tokenStorageProvider = Provider<TokenStorage>((ref) {
  throw UnimplementedError('tokenStorageProvider must be overridden in main');
});

/// Single [ApiClient] instance.
final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(ref.watch(tokenStorageProvider));
});
