import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme.dart';
import 'auth_controller.dart';

/// Shown while auth state is being resolved.
///
/// Reading [authControllerProvider] here instantiates the [AuthController],
/// whose constructor bootstraps auth state from persisted tokens. The router's
/// redirect gate then routes `unknown → /splash`, and once the status settles
/// to `authenticated` / `unauthenticated` / `needsTelegramLink` it bounces the
/// user onward automatically. No manual navigation needed.
class SplashScreen extends ConsumerWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Instantiate the controller (kicks off token bootstrap + redirect).
    ref.watch(authControllerProvider);

    final c = AppColors.of(context);
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 88,
              height: 88,
              decoration: BoxDecoration(
                color: c.brand.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(AppTheme.radiusLg),
              ),
              child: Icon(Icons.lightbulb_rounded, size: 48, color: c.brand),
            ),
            const SizedBox(height: 20),
            Text(
              'SolutionLab',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w800,
                color: c.ink,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Muammodan yechimga',
              style: TextStyle(fontSize: 14, color: c.muted),
            ),
            const SizedBox(height: 28),
            SizedBox(
              width: 26,
              height: 26,
              child: CircularProgressIndicator(
                strokeWidth: 2.6,
                valueColor: AlwaysStoppedAnimation(c.brand),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
