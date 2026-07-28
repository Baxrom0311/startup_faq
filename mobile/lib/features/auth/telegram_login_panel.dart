import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/config.dart';
import '../../core/theme.dart';
import '../../models/auth_models.dart';
import '../../shared/widgets/widgets.dart';
import 'auth_controller.dart';

/// Reusable Telegram phone → start → deep-link → poll flow.
///
/// Used both for the primary login ([LoginScreen]) and for linking Telegram to
/// an existing Google account ([ConnectTelegramScreen]). On successful
/// verification, [AuthController.pollTelegramStatus] persists the tokens and
/// flips auth state to `authenticated`, which the router redirect picks up.
/// [onVerified] is an extra hook (e.g. to call `markTelegramLinked`).
class TelegramLoginPanel extends ConsumerStatefulWidget {
  const TelegramLoginPanel({
    super.key,
    this.onVerified,
    this.ctaLabel = 'Telegram bilan kirish',
  });

  /// Called once, after the login is verified.
  final VoidCallback? onVerified;

  /// Label of the primary start button.
  final String ctaLabel;

  @override
  ConsumerState<TelegramLoginPanel> createState() => _TelegramLoginPanelState();
}

enum _Phase { input, waiting, done }

class _TelegramLoginPanelState extends ConsumerState<TelegramLoginPanel> {
  final _formKey = GlobalKey<FormState>();
  final _phoneController = TextEditingController();

  _Phase _phase = _Phase.input;
  bool _starting = false;
  String? _error;

  TelegramStartResult? _session;
  Timer? _pollTimer;
  Timer? _timeoutTimer;
  bool _polling = false;

  @override
  void dispose() {
    _phoneController.dispose();
    _pollTimer?.cancel();
    _timeoutTimer?.cancel();
    super.dispose();
  }

  /// Digits typed by the user (without the +998 prefix), max 9.
  String get _digits => _phoneController.text.replaceAll(RegExp(r'\D'), '');

  /// Full E.164 phone (e.g. +998901234567).
  String get _fullPhone => '+998$_digits';

  Future<void> _start() async {
    FocusScope.of(context).unfocus();
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() {
      _starting = true;
      _error = null;
    });

    try {
      final controller = ref.read(authControllerProvider.notifier);
      final session = await controller.startTelegramLogin(_fullPhone);
      if (!mounted) return;
      setState(() {
        _session = session;
        _phase = _Phase.waiting;
        _starting = false;
      });
      await _openDeepLink(session.deepLink);
      _beginPolling();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _starting = false;
        _error = e.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _starting = false;
        _error = 'Ulanishda xatolik. Internetni tekshirib, qayta urinib ko\'ring.';
      });
    }
  }

  Future<void> _openDeepLink(String deepLink) async {
    final uri = Uri.tryParse(deepLink);
    if (uri == null) return;
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Telegram ilovasini ochib bo\'lmadi. Uni o\'zingiz oching.';
      });
    }
  }

  void _beginPolling() {
    _pollTimer?.cancel();
    _timeoutTimer?.cancel();

    _timeoutTimer = Timer(AppConfig.telegramPollTimeout, () {
      if (!mounted || _phase != _Phase.waiting) return;
      _stopPolling();
      setState(() {
        _phase = _Phase.input;
        _error = 'Vaqt tugadi. Iltimos, qayta urinib ko\'ring.';
      });
    });

    _pollTimer = Timer.periodic(AppConfig.telegramPollInterval, (_) => _poll());
    // Kick off an immediate first poll rather than waiting a full interval.
    _poll();
  }

  Future<void> _poll() async {
    final session = _session;
    if (session == null || _polling || !mounted) return;
    _polling = true;
    try {
      final controller = ref.read(authControllerProvider.notifier);
      final result = await controller.pollTelegramStatus(session.sessionId);
      if (!mounted) return;

      switch (result.status) {
        case TelegramLoginStatus.verified:
          _stopPolling();
          setState(() => _phase = _Phase.done);
          widget.onVerified?.call();
          break;
        case TelegramLoginStatus.expired:
          _failTerminal('Havola muddati tugadi. Qayta urinib ko\'ring.');
          break;
        case TelegramLoginStatus.phoneMismatch:
          _failTerminal(
            'Telegramdagi raqam kiritilgan raqamga mos kelmadi.',
          );
          break;
        case TelegramLoginStatus.timedOut:
          _failTerminal('Vaqt tugadi. Qayta urinib ko\'ring.');
          break;
        case TelegramLoginStatus.pending:
        case TelegramLoginStatus.usedStart:
        case TelegramLoginStatus.unknown:
          // keep polling
          break;
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      _failTerminal(e.message);
    } catch (_) {
      // Transient network error — keep polling until timeout.
    } finally {
      _polling = false;
    }
  }

  void _failTerminal(String message) {
    _stopPolling();
    if (!mounted) return;
    setState(() {
      _phase = _Phase.input;
      _error = message;
    });
  }

  void _stopPolling() {
    _pollTimer?.cancel();
    _timeoutTimer?.cancel();
    _pollTimer = null;
    _timeoutTimer = null;
  }

  void _cancelWaiting() {
    _stopPolling();
    setState(() {
      _phase = _Phase.input;
      _session = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return switch (_phase) {
      _Phase.input => _buildInput(c),
      _Phase.waiting => _buildWaiting(c),
      _Phase.done => _buildDone(c),
    };
  }

  Widget _buildInput(AppColors c) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'Telefon raqamingiz',
            style: TextStyle(
              fontWeight: FontWeight.w600,
              color: c.ink,
            ),
          ),
          const SizedBox(height: 8),
          TextFormField(
            controller: _phoneController,
            keyboardType: TextInputType.phone,
            autofillHints: const [AutofillHints.telephoneNumber],
            inputFormatters: [_UzPhoneFormatter()],
            style: const TextStyle(
              fontFeatures: [FontFeature.tabularFigures()],
              fontSize: 18,
              letterSpacing: 0.5,
            ),
            decoration: InputDecoration(
              prefixIcon: Padding(
                padding: const EdgeInsets.only(left: 16, right: 8),
                child: Text(
                  '+998',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                    color: c.ink,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              ),
              prefixIconConstraints: const BoxConstraints(minWidth: 0),
              hintText: '90 123 45 67',
            ),
            validator: (_) {
              if (_digits.length != 9) {
                return 'To\'liq raqam kiriting (9 ta raqam).';
              }
              return null;
            },
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            _ErrorText(_error!),
          ],
          const SizedBox(height: 16),
          AppButton(
            label: widget.ctaLabel,
            icon: Icons.send_rounded,
            loading: _starting,
            onPressed: _start,
          ),
          const SizedBox(height: 10),
          Text(
            'Tasdiqlash uchun Telegram ilovasi ochiladi.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 12.5, color: c.muted),
          ),
        ],
      ),
    );
  }

  Widget _buildWaiting(AppColors c) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: c.brand.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(AppTheme.radius),
            border: Border.all(color: c.line),
          ),
          child: Column(
            children: [
              SizedBox(
                width: 34,
                height: 34,
                child: CircularProgressIndicator(
                  strokeWidth: 3,
                  valueColor: AlwaysStoppedAnimation(c.brand),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Telegramda tasdiqlashni kuting',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 16,
                  color: c.ink,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Telegram ilovasida "Start" tugmasini bosing va telefon '
                'raqamingizni ulashing. Tasdiqlangach avtomatik davom etadi.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: c.muted, height: 1.4),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        AppButton(
          label: 'Telegramni qayta ochish',
          variant: AppButtonVariant.outline,
          icon: Icons.open_in_new_rounded,
          onPressed: () {
            final link = _session?.deepLink;
            if (link != null) _openDeepLink(link);
          },
        ),
        const SizedBox(height: 8),
        TextButton(
          onPressed: _cancelWaiting,
          child: const Text('Bekor qilish'),
        ),
      ],
    );
  }

  Widget _buildDone(AppColors c) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.check_circle_rounded, size: 48, color: c.green),
        const SizedBox(height: 12),
        Text(
          'Tasdiqlandi!',
          style: TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 18,
            color: c.ink,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'Davom etilmoqda...',
          style: TextStyle(color: c.muted),
        ),
      ],
    );
  }
}

/// Small inline error row.
class _ErrorText extends StatelessWidget {
  const _ErrorText(this.message);
  final String message;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(Icons.error_outline_rounded, size: 18, color: scheme.error),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            message,
            style: TextStyle(color: scheme.error, fontSize: 13, height: 1.35),
          ),
        ),
      ],
    );
  }
}

/// Formats the local part of an Uzbek mobile number as `XX XXX XX XX`
/// (9 digits max). The `+998` country code is shown as a static prefix.
class _UzPhoneFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    var digits = newValue.text.replaceAll(RegExp(r'\D'), '');
    // If the user pastes a full number, drop a leading 998.
    if (digits.startsWith('998') && digits.length > 9) {
      digits = digits.substring(3);
    }
    if (digits.length > 9) digits = digits.substring(0, 9);

    final buffer = StringBuffer();
    for (var i = 0; i < digits.length; i++) {
      // Grouping: 2 | 3 | 2 | 2  -> spaces after index 1, 4, 6.
      if (i == 2 || i == 5 || i == 7) buffer.write(' ');
      buffer.write(digits[i]);
    }
    final text = buffer.toString();
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}
