import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme.dart';
import '../auth/auth_controller.dart';
import 'app_settings_controller.dart';

/// Clean settings list: language, theme, about, and logout.
class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  bool _loggingOut = false;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final settings = ref.watch(appSettingsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Sozlamalar')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        children: [
          _SectionLabel('Umumiy'),
          _SettingsCard(
            children: [
              _SettingsTile(
                icon: Icons.translate_rounded,
                iconColor: c.brand,
                title: 'Til',
                value: settings.language.nativeLabel,
                onTap: _pickLanguage,
              ),
              _TileDivider(color: c.line),
              _SettingsTile(
                icon: Icons.brightness_6_outlined,
                iconColor: c.gold,
                title: 'Mavzu',
                value: _themeLabel(settings.themeMode),
                onTap: _pickTheme,
              ),
            ],
          ),
          const SizedBox(height: 20),
          _SectionLabel('Ilova haqida'),
          _SettingsCard(
            children: [
              _SettingsTile(
                icon: Icons.info_outline_rounded,
                iconColor: c.muted,
                title: 'Versiya',
                value: '1.0.0',
              ),
            ],
          ),
          const SizedBox(height: 28),
          _LogoutButton(
            loading: _loggingOut,
            onTap: _confirmLogout,
          ),
        ],
      ),
    );
  }

  // ---- Language ---------------------------------------------------------

  Future<void> _pickLanguage() async {
    final current = ref.read(appSettingsProvider).language;
    final selected = await _showOptionSheet<AppLanguage>(
      title: 'Tilni tanlang',
      options: [
        for (final l in AppLanguage.values)
          _Option(
            value: l,
            label: l.nativeLabel,
            leadingEmoji: l.flag,
            selected: l == current,
          ),
      ],
    );
    if (selected != null) {
      await ref.read(appSettingsProvider.notifier).setLanguage(selected);
    }
  }

  // ---- Theme ------------------------------------------------------------

  Future<void> _pickTheme() async {
    final current = ref.read(appSettingsProvider).themeMode;
    final selected = await _showOptionSheet<ThemeMode>(
      title: 'Mavzuni tanlang',
      options: [
        _Option(
          value: ThemeMode.system,
          label: _themeLabel(ThemeMode.system),
          leadingIcon: Icons.phone_android_rounded,
          selected: current == ThemeMode.system,
        ),
        _Option(
          value: ThemeMode.light,
          label: _themeLabel(ThemeMode.light),
          leadingIcon: Icons.light_mode_rounded,
          selected: current == ThemeMode.light,
        ),
        _Option(
          value: ThemeMode.dark,
          label: _themeLabel(ThemeMode.dark),
          leadingIcon: Icons.dark_mode_rounded,
          selected: current == ThemeMode.dark,
        ),
      ],
    );
    if (selected != null) {
      await ref.read(appSettingsProvider.notifier).setThemeMode(selected);
    }
  }

  String _themeLabel(ThemeMode m) => switch (m) {
        ThemeMode.system => 'Tizim',
        ThemeMode.light => 'Yorug‘',
        ThemeMode.dark => 'Qorong‘i',
      };

  // ---- Logout -----------------------------------------------------------

  Future<void> _confirmLogout() async {
    final c = AppColors.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Chiqish'),
        content: const Text('Hisobingizdan chiqmoqchimisiz?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Bekor qilish'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: TextButton.styleFrom(foregroundColor: c.owner),
            child: const Text('Chiqish'),
          ),
        ],
      ),
    );
    if (ok != true) return;

    setState(() => _loggingOut = true);
    try {
      await ref.read(authControllerProvider.notifier).logout();
      // The router redirect gate will navigate to /login automatically once
      // auth state becomes unauthenticated.
    } finally {
      if (mounted) setState(() => _loggingOut = false);
    }
  }

  // ---- Option picker ----------------------------------------------------

  Future<T?> _showOptionSheet<T>({
    required String title,
    required List<_Option<T>> options,
  }) {
    final c = AppColors.of(context);
    return showModalBottomSheet<T>(
      context: context,
      backgroundColor: c.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 12),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: c.line,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              const SizedBox(height: 14),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    title,
                    style: Theme.of(ctx)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
              ),
              const SizedBox(height: 6),
              for (final o in options)
                ListTile(
                  onTap: () => Navigator.of(ctx).pop(o.value),
                  leading: o.leadingEmoji != null
                      ? Text(o.leadingEmoji!,
                          style: const TextStyle(fontSize: 22))
                      : Icon(o.leadingIcon, color: c.muted),
                  title: Text(o.label),
                  trailing: o.selected
                      ? Icon(Icons.check_rounded, color: c.brand)
                      : null,
                ),
              const SizedBox(height: 8),
            ],
          ),
        );
      },
    );
  }
}

class _Option<T> {
  const _Option({
    required this.value,
    required this.label,
    required this.selected,
    this.leadingIcon,
    this.leadingEmoji,
  });

  final T value;
  final String label;
  final bool selected;
  final IconData? leadingIcon;
  final String? leadingEmoji;
}

// ---- Presentational pieces ----------------------------------------------

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Text(
        text,
        style: Theme.of(context)
            .textTheme
            .labelLarge
            ?.copyWith(color: c.muted, fontWeight: FontWeight.w700),
      ),
    );
  }
}

class _SettingsCard extends StatelessWidget {
  const _SettingsCard({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(AppTheme.radius),
        border: Border.all(color: c.line),
      ),
      child: Column(children: children),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  const _SettingsTile({
    required this.icon,
    required this.iconColor,
    required this.title,
    this.value,
    this.onTap,
  });

  final IconData icon;
  final Color iconColor;
  final String title;
  final String? value;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: iconColor.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
        ),
        child: Icon(icon, size: 20, color: iconColor),
      ),
      title: Text(
        title,
        style: Theme.of(context)
            .textTheme
            .titleMedium
            ?.copyWith(fontWeight: FontWeight.w600),
      ),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (value != null)
            Text(
              value!,
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(color: c.muted),
            ),
          if (onTap != null) ...[
            const SizedBox(width: 4),
            Icon(Icons.chevron_right_rounded, color: c.muted),
          ],
        ],
      ),
    );
  }
}

class _TileDivider extends StatelessWidget {
  const _TileDivider({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) =>
      Divider(height: 1, thickness: 1, indent: 68, color: color);
}

class _LogoutButton extends StatelessWidget {
  const _LogoutButton({required this.loading, required this.onTap});

  final bool loading;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return OutlinedButton.icon(
      onPressed: loading ? null : onTap,
      style: OutlinedButton.styleFrom(
        foregroundColor: c.owner,
        side: BorderSide(color: c.owner.withValues(alpha: 0.4)),
        minimumSize: const Size(0, 52),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppTheme.radius),
        ),
      ),
      icon: loading
          ? SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(
                strokeWidth: 2.2,
                valueColor: AlwaysStoppedAnimation(c.owner),
              ),
            )
          : const Icon(Icons.logout_rounded, size: 20),
      label: const Text('Hisobdan chiqish'),
    );
  }
}
