import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme.dart';
import 'auth_controller.dart';
import 'telegram_login_panel.dart';

/// Shown when a user signed in with Google but has not linked Telegram yet.
/// The app is gated until Telegram is linked. Reuses [TelegramLoginPanel];
/// on verification the tokens are refreshed and auth flips to `authenticated`.
class ConnectTelegramScreen extends ConsumerWidget {
  const ConnectTelegramScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = AppColors.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Telegramni ulash'),
        actions: [
          TextButton(
            onPressed: () => ref.read(authControllerProvider.notifier).logout(),
            child: const Text('Chiqish'),
          ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      color: c.brand.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(AppTheme.radiusLg),
                    ),
                    child: Icon(Icons.link_rounded, size: 38, color: c.brand),
                  ),
                  const SizedBox(height: 18),
                  Text(
                    'Telegramni ulang',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: c.ink,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Davom etish uchun Telegram hisobingizni ulashingiz kerak. '
                    'Bu bir marotaba amalga oshiriladi.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 14, color: c.muted, height: 1.4),
                  ),
                  const SizedBox(height: 24),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: TelegramLoginPanel(
                        ctaLabel: 'Telegramni ulash',
                        onVerified: () =>
                            ref.read(authControllerProvider.notifier)
                                .markTelegramLinked(),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
