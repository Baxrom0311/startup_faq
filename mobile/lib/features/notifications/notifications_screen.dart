import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../core/router.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import 'notifications_controller.dart';

/// Notifications inbox.
///
/// Lists `GET /notifications`, shows a localized (Uzbek) label per type,
/// an unread dot, a "hammasini o'qilgan qilish" action, and pull-to-refresh.
/// Tapping a notification marks it read and navigates to the related problem.
class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = AppColors.of(context);
    final async = ref.watch(notificationsControllerProvider);
    final controller = ref.read(notificationsControllerProvider.notifier);
    final unread = async.valueOrNull?.unreadCount ?? 0;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Bildirishnomalar'),
        actions: [
          if (unread > 0)
            TextButton.icon(
              onPressed: () => _markAll(context, controller),
              icon: const Icon(Icons.done_all, size: 18),
              label: const Text("Hammasini o‘qilgan"),
            ),
        ],
      ),
      body: RefreshIndicator(
        color: c.brand,
        onRefresh: controller.refresh,
        child: async.when(
          loading: () => const _CenteredScrollable(
            child: Padding(
              padding: EdgeInsets.only(top: 80),
              child: CircularProgressIndicator(),
            ),
          ),
          error: (e, _) => _CenteredScrollable(
            child: _ErrorView(
              message: e is ApiException ? e.message : 'Xatolik yuz berdi',
              onRetry: controller.refresh,
            ),
          ),
          data: (state) {
            if (state.items.isEmpty) {
              return const _CenteredScrollable(child: _EmptyView());
            }
            return ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: state.items.length,
              separatorBuilder: (_, __) =>
                  Divider(height: 1, indent: 72, color: c.line),
              itemBuilder: (context, i) {
                final n = state.items[i];
                return _NotificationTile(
                  item: n,
                  onTap: () => _open(context, controller, n),
                );
              },
            );
          },
        ),
      ),
    );
  }

  Future<void> _markAll(
    BuildContext context,
    NotificationsController controller,
  ) async {
    try {
      await controller.markAllRead();
    } catch (e) {
      if (context.mounted) {
        _snack(context, e is ApiException ? e.message : 'Xatolik yuz berdi');
      }
    }
  }

  Future<void> _open(
    BuildContext context,
    NotificationsController controller,
    NotificationItem n,
  ) async {
    // Mark read (best-effort) but don't block navigation on the network call.
    if (!n.isRead) {
      controller.markRead(n.id).catchError((_) {});
    }
    final problemId = _targetProblemId(n);
    if (problemId != null) {
      context.push(Routes.problem(problemId));
    } else {
      _snack(context, 'Ushbu bildirishnomani ochib bo‘lmadi');
    }
  }

  /// Resolves which problem to open, mirroring the web `notificationLink`
  /// logic collapsed onto the mobile routes (problem detail only).
  static String? _targetProblemId(NotificationItem n) {
    final p = n.payload;
    final targetProblemId = _payloadStr(p, 'target_problem_id');
    final problemId = _payloadStr(p, 'problem_id');
    if (n.type == 'problem.merged' && targetProblemId != null) {
      return targetProblemId;
    }
    return problemId;
  }

  static String? _payloadStr(Map<String, dynamic> p, String key) {
    final v = p[key];
    if (v is String && v.isNotEmpty) return v;
    return null;
  }

  void _snack(BuildContext context, String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }
}

// ---------------------------------------------------------------------------

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.item, required this.onTap});

  final NotificationItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final (icon, tint) = _visual(item.type, c);
    final unread = !item.isRead;

    return InkWell(
      onTap: onTap,
      child: Container(
        color: unread ? c.brand.withValues(alpha: 0.05) : Colors.transparent,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: tint.withValues(alpha: 0.14),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 20, color: tint),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _label(item),
                    style: TextStyle(
                      color: c.ink,
                      fontSize: 14.5,
                      height: 1.35,
                      fontWeight: unread ? FontWeight.w700 : FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _relativeTime(item.createdAt),
                    style: TextStyle(color: c.muted, fontSize: 12),
                  ),
                ],
              ),
            ),
            if (unread) ...[
              const SizedBox(width: 10),
              Container(
                margin: const EdgeInsets.only(top: 6),
                width: 9,
                height: 9,
                decoration: BoxDecoration(
                  color: c.brand,
                  shape: BoxShape.circle,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  /// Uzbek label per type — mirrors the web `notificationLabel`.
  static String _label(NotificationItem n) {
    final p = n.payload;
    final projectTitle = _str(p['project_title']) ?? 'Loyiha';
    final problemTitle = _str(p['title']) ?? '—';
    final commenter = _str(p['commenter_name']);
    final commented = commenter != null
        ? '$commenter — yangi izoh'
        : '“$problemTitle” — yangi izoh';

    switch (n.type) {
      case 'project.proposed':
        return '$projectTitle — taklif yuborildi';
      case 'project.approved':
        return '$projectTitle — qabul qilindi';
      case 'project.rejected':
        return '$projectTitle — rad etildi';
      case 'project.piloting_started':
        return '$projectTitle — pilot boshlandi';
      case 'project.completed':
        return '$projectTitle — yakunlandi';
      case 'problem.published':
        return '“$problemTitle” — nashr qilindi';
      case 'problem.archived':
        return '“$problemTitle” — arxivlandi';
      case 'problem.merged':
        return '“$problemTitle” — birlashtirildi';
      case 'problem.commented':
        return commented;
      default:
        return n.type;
    }
  }

  static (IconData, Color) _visual(String type, AppColors c) {
    switch (type) {
      case 'project.proposed':
        return (Icons.lightbulb_outline, c.gold);
      case 'project.approved':
        return (Icons.verified_outlined, c.green);
      case 'project.rejected':
        return (Icons.cancel_outlined, c.muted);
      case 'project.piloting_started':
        return (Icons.rocket_launch_outlined, c.gold);
      case 'project.completed':
        return (Icons.emoji_events_outlined, c.gold);
      case 'problem.published':
        return (Icons.campaign_outlined, c.green);
      case 'problem.archived':
        return (Icons.archive_outlined, c.muted);
      case 'problem.merged':
        return (Icons.merge_type, c.brand);
      case 'problem.commented':
        return (Icons.chat_bubble_outline, c.brand);
      default:
        return (Icons.notifications_none, c.brand);
    }
  }

  static String? _str(dynamic v) {
    if (v is String && v.isNotEmpty) return v;
    return null;
  }

  /// Lightweight Uzbek relative time — avoids depending on intl locale data.
  static String _relativeTime(String iso) {
    final dt = DateTime.tryParse(iso);
    if (dt == null) return '';
    final diff = DateTime.now().difference(dt.toLocal());
    if (diff.inSeconds < 60) return 'hozir';
    if (diff.inMinutes < 60) return '${diff.inMinutes} daqiqa oldin';
    if (diff.inHours < 24) return '${diff.inHours} soat oldin';
    if (diff.inDays < 7) return '${diff.inDays} kun oldin';
    if (diff.inDays < 30) return '${(diff.inDays / 7).floor()} hafta oldin';
    if (diff.inDays < 365) return '${(diff.inDays / 30).floor()} oy oldin';
    return '${(diff.inDays / 365).floor()} yil oldin';
  }
}

// ---------------------------------------------------------------------------

/// Wraps a widget so it still fills the viewport and stays pull-to-refreshable
/// when the list is empty / loading / errored.
class _CenteredScrollable extends StatelessWidget {
  const _CenteredScrollable({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        return SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: constraints.maxHeight),
            child: Center(child: child),
          ),
        );
      },
    );
  }
}

class _EmptyView extends StatelessWidget {
  const _EmptyView();

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.notifications_none, size: 56, color: c.muted),
          const SizedBox(height: 16),
          Text(
            'Hozircha bildirishnomalar yo‘q',
            style: TextStyle(
              color: c.ink,
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Yangiliklar shu yerda paydo bo‘ladi',
            textAlign: TextAlign.center,
            style: TextStyle(color: c.muted, fontSize: 13.5),
          ),
        ],
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.wifi_off_rounded, size: 56, color: c.muted),
          const SizedBox(height: 16),
          Text(
            message,
            textAlign: TextAlign.center,
            style: TextStyle(color: c.ink, fontSize: 15),
          ),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: const Text('Qayta urinish'),
          ),
        ],
      ),
    );
  }
}
