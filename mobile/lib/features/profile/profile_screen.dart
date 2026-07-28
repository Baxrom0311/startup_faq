import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router.dart';
import '../../core/theme.dart';
import '../../shared/widgets/widgets.dart';
import 'current_user_provider.dart';
import 'settings_screen.dart';

/// Profile tab: current user card, quick links, and an entry into settings.
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = AppColors.of(context);
    final user = ref.watch(currentUserProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profil'),
        actions: [
          IconButton(
            tooltip: 'Sozlamalar',
            icon: const Icon(Icons.settings_outlined),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => const SettingsScreen(),
              ),
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          _ProfileHeader(user: user),
          const SizedBox(height: 20),
          Text(
            'Faoliyat',
            style: Theme.of(context)
                .textTheme
                .labelLarge
                ?.copyWith(color: c.muted, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          _MenuCard(
            children: [
              _MenuTile(
                icon: Icons.assignment_outlined,
                iconColor: c.brand,
                title: 'Mening muammolarim',
                subtitle: "Siz yuborgan muammolar",
                onTap: () => context.go(Routes.home),
              ),
              _MenuDivider(color: c.line),
              _MenuTile(
                icon: Icons.settings_outlined,
                iconColor: c.muted,
                title: 'Sozlamalar',
                subtitle: 'Til, mavzu va boshqalar',
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const SettingsScreen(),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({required this.user});

  final SessionUser? user;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final role = user?.role;
    final reputation = user?.reputation;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        border: Border.all(color: c.line),
      ),
      child: Column(
        children: [
          UserAvatar(
            name: user?.displayName,
            role: role,
            imageUrl: user?.avatarUrl,
            radius: 40,
          ),
          const SizedBox(height: 14),
          Text(
            user?.displayName ?? 'Foydalanuvchi',
            textAlign: TextAlign.center,
            style: Theme.of(context)
                .textTheme
                .titleLarge
                ?.copyWith(fontWeight: FontWeight.w800),
          ),
          if (user?.subtitle != null) ...[
            const SizedBox(height: 4),
            Text(
              user!.subtitle!,
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(color: c.muted),
            ),
          ],
          const SizedBox(height: 12),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 8,
            runSpacing: 8,
            children: [
              if (role != null) RoleBadge(role: role),
              if (reputation != null) _ReputationChip(value: reputation),
            ],
          ),
        ],
      ),
    );
  }
}

class _ReputationChip extends StatelessWidget {
  const _ReputationChip({required this.value});

  final int value;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: c.gold.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: c.gold.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.star_rounded, size: 14, color: c.gold),
          const SizedBox(width: 4),
          Text(
            '$value ball',
            style: TextStyle(
              color: c.gold,
              fontSize: 11,
              fontWeight: FontWeight.w700,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}

/// Rounded card that groups a list of [_MenuTile]s.
class _MenuCard extends StatelessWidget {
  const _MenuCard({required this.children});

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

class _MenuTile extends StatelessWidget {
  const _MenuTile({
    required this.icon,
    required this.iconColor,
    required this.title,
    this.subtitle,
    this.onTap,
  });

  final IconData icon;
  final Color iconColor;
  final String title;
  final String? subtitle;
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
      subtitle: subtitle == null
          ? null
          : Text(subtitle!,
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: c.muted)),
      trailing: Icon(Icons.chevron_right_rounded, color: c.muted),
    );
  }
}

class _MenuDivider extends StatelessWidget {
  const _MenuDivider({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) =>
      Divider(height: 1, thickness: 1, indent: 68, color: color);
}
