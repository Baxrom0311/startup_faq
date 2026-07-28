import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../shared/widgets/widgets.dart';
import 'auth_controller.dart';
import 'google_sign_in_stub.dart';
import 'telegram_login_panel.dart';

/// Primary login screen. Telegram is the main path; Google is secondary and
/// routes to Telegram linking when the account has no Telegram yet.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  bool _googleLoading = false;

  Future<void> _signInWithGoogle() async {
    setState(() => _googleLoading = true);
    try {
      // Integration point: obtain a Google ID token (see google_sign_in_stub).
      final credential = await obtainGoogleCredential(context);
      if (credential == null) {
        if (mounted) setState(() => _googleLoading = false);
        return;
      }
      // On success this persists tokens and flips auth state; the router
      // redirect then routes to /home or /connect-telegram automatically.
      await ref.read(authControllerProvider.notifier).loginWithGoogle(credential);
    } on ApiException catch (e) {
      _showError(e.message);
    } catch (_) {
      _showError('Google orqali kirishda xatolik yuz berdi.');
    } finally {
      if (mounted) setState(() => _googleLoading = false);
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: [
                  _Header(c: c),
                  const SizedBox(height: 32),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: TelegramLoginPanel(),
                    ),
                  ),
                  const SizedBox(height: 20),
                  _OrDivider(c: c),
                  const SizedBox(height: 20),
                  AppButton(
                    label: 'Google bilan kirish',
                    variant: AppButtonVariant.outline,
                    icon: Icons.g_mobiledata_rounded,
                    loading: _googleLoading,
                    onPressed: _signInWithGoogle,
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'Kirish orqali siz foydalanish shartlariga rozilik '
                    'bildirasiz.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 12, color: c.muted, height: 1.4),
                  ),
                  if (kDebugMode) ...[
                    const SizedBox(height: 8),
                    Text(
                      'Debug: Google tugmasi ID token kiritish oynasini ochadi.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 11,
                        color: c.muted.withValues(alpha: 0.7),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.c});
  final AppColors c;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 76,
          height: 76,
          decoration: BoxDecoration(
            color: c.brand.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(AppTheme.radiusLg),
          ),
          child: Icon(Icons.lightbulb_rounded, size: 40, color: c.brand),
        ),
        const SizedBox(height: 18),
        Text(
          'SolutionLab',
          style: TextStyle(
            fontSize: 26,
            fontWeight: FontWeight.w800,
            color: c.ink,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Muammoni ayting — birga yechim topamiz.',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 15, color: c.muted, height: 1.4),
        ),
      ],
    );
  }
}

class _OrDivider extends StatelessWidget {
  const _OrDivider({required this.c});
  final AppColors c;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: Divider(color: c.line)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Text(
            'yoki',
            style: TextStyle(color: c.muted, fontSize: 13),
          ),
        ),
        Expanded(child: Divider(color: c.line)),
      ],
    );
  }
}
