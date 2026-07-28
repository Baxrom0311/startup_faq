import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../core/theme.dart';

/// ============================================================================
/// GOOGLE SIGN-IN INTEGRATION POINT
/// ============================================================================
///
/// The backend expects a Google **ID token** (`credential`) at
/// `POST /auth/google/verify`. Obtaining that token requires the
/// `google_sign_in` package, which is intentionally NOT yet added to
/// `pubspec.yaml` (it needs per-platform OAuth client configuration).
///
/// The integration phase should replace the body of [obtainGoogleCredential]
/// with the real flow, roughly:
///
/// ```dart
/// // pubspec.yaml:  google_sign_in: ^6.x
/// final googleSignIn = GoogleSignIn(
///   serverClientId: AppConfig.googleClientId, // audience for the id token
///   scopes: const ['email', 'profile'],
/// );
/// final account = await googleSignIn.signIn();      // may return null (cancel)
/// final auth = await account?.authentication;
/// return auth?.idToken;                              // -> loginWithGoogle(...)
/// ```
///
/// Until then, this returns `null` in release builds (Google button no-ops with
/// a message) and, in debug builds, opens a dialog to paste a token so the
/// verify flow can be exercised end-to-end.
Future<String?> obtainGoogleCredential(BuildContext context) async {
  if (kDebugMode) {
    return _promptForDebugToken(context);
  }

  // Release: no real integration yet.
  ScaffoldMessenger.of(context).showSnackBar(
    const SnackBar(
      content: Text(
        'Google orqali kirish tez orada ishga tushadi. Hozircha Telegram '
        'orqali kiring.',
      ),
    ),
  );
  return null;
}

/// Debug-only: paste a Google ID token to test the verify flow.
Future<String?> _promptForDebugToken(BuildContext context) async {
  final controller = TextEditingController();
  final c = AppColors.of(context);
  final result = await showDialog<String>(
    context: context,
    builder: (context) {
      return AlertDialog(
        title: const Text('Google ID token (debug)'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Google ID token joylashtiring. Ishlab chiqarishda bu oyna '
              'o\'rniga haqiqiy google_sign_in oqimi bo\'ladi.',
              style: TextStyle(fontSize: 13, color: c.muted),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              maxLines: 4,
              minLines: 2,
              decoration: const InputDecoration(hintText: 'eyJhbGci...'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Bekor qilish'),
          ),
          FilledButton(
            onPressed: () {
              final text = controller.text.trim();
              Navigator.of(context).pop(text.isEmpty ? null : text);
            },
            child: const Text('Davom etish'),
          ),
        ],
      );
    },
  );
  controller.dispose();
  return result;
}
