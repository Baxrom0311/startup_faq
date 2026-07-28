import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../models/json_utils.dart';

/// Lightweight view of the signed-in user, derived from the JWT access token.
///
/// The backend contract does not expose a `/me` endpoint or a `User` model, so
/// we read whatever standard claims the token carries. All fields are optional
/// and rendered defensively. Swap this for a real endpoint in a later phase
/// (see feature summary).
class SessionUser {
  const SessionUser({
    this.id,
    this.name,
    this.username,
    this.phone,
    this.role,
    this.reputation,
    this.avatarUrl,
  });

  final String? id;
  final String? name;
  final String? username;
  final String? phone;
  final AppRole? role;
  final int? reputation;
  final String? avatarUrl;

  /// Best display name available, falling back through the known claims.
  String get displayName {
    final n = name?.trim();
    if (n != null && n.isNotEmpty) return n;
    final u = username?.trim();
    if (u != null && u.isNotEmpty) return u;
    final p = phone?.trim();
    if (p != null && p.isNotEmpty) return p;
    return 'Foydalanuvchi';
  }

  /// A secondary line under the name (username or phone).
  String? get subtitle {
    final u = username?.trim();
    if (u != null && u.isNotEmpty) return '@$u';
    final p = phone?.trim();
    if (p != null && p.isNotEmpty) return p;
    return null;
  }

  static SessionUser? fromClaims(Map<String, dynamic> c) {
    if (c.isEmpty) return null;

    final first = J.strOrNull(c['first_name'])?.trim();
    final last = J.strOrNull(c['last_name'])?.trim();
    var name = J.strOrNull(c['name'] ?? c['full_name'] ?? c['display_name']);
    if ((name == null || name.trim().isEmpty) &&
        (first != null || last != null)) {
      name = [first, last].where((s) => s != null && s.isNotEmpty).join(' ');
    }

    return SessionUser(
      id: J.strOrNull(c['sub'] ?? c['user_id'] ?? c['id']),
      name: (name != null && name.trim().isNotEmpty) ? name.trim() : null,
      username: J.strOrNull(c['username']),
      phone: J.strOrNull(c['phone'] ?? c['phone_number']),
      role: _roleFrom(J.strOrNull(c['role'])),
      reputation: J.intOrNull(c['reputation'] ?? c['rep'] ?? c['score']),
      avatarUrl: J.strOrNull(
          c['avatar_url'] ?? c['photo_url'] ?? c['picture'] ?? c['avatar']),
    );
  }

  static AppRole? _roleFrom(String? v) {
    switch (v?.toLowerCase()) {
      case 'owner':
      case 'author':
        return AppRole.owner;
      case 'startup':
      case 'founder':
        return AppRole.startup;
      case 'citizen':
      case 'user':
        return AppRole.citizen;
      default:
        return null;
    }
  }
}

/// Decodes the payload segment of a JWT into a claims map. Returns an empty
/// map on any malformed input.
Map<String, dynamic> _decodeJwtClaims(String token) {
  try {
    final parts = token.split('.');
    if (parts.length != 3) return const {};
    var payload = parts[1].replaceAll('-', '+').replaceAll('_', '/');
    switch (payload.length % 4) {
      case 2:
        payload += '==';
        break;
      case 3:
        payload += '=';
        break;
    }
    final decoded = utf8.decode(base64.decode(payload));
    final json = jsonDecode(decoded);
    return json is Map ? Map<String, dynamic>.from(json) : const {};
  } catch (_) {
    return const {};
  }
}

/// The current user derived from the stored access token, or `null` if there is
/// no session / the token carries no useful claims.
final currentUserProvider = Provider<SessionUser?>((ref) {
  final token = ref.watch(tokenStorageProvider).accessToken;
  if (token == null || token.isEmpty) return null;
  return SessionUser.fromClaims(_decodeJwtClaims(token));
});
