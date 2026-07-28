import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../core/config.dart';
import '../../models/models.dart';

/// Immutable state for the notifications list.
class NotificationsState {
  const NotificationsState({
    this.items = const <NotificationItem>[],
    this.unreadCount = 0,
  });

  final List<NotificationItem> items;
  final int unreadCount;

  NotificationsState copyWith({
    List<NotificationItem>? items,
    int? unreadCount,
  }) {
    return NotificationsState(
      items: items ?? this.items,
      unreadCount: unreadCount ?? this.unreadCount,
    );
  }
}

/// Loads and mutates the current user's notifications.
///
/// Backend:
///  * `GET  /notifications?limit=` → `{data, count, unread_count}`
///  * `POST /notifications/read {notification_ids: []}` (empty = mark all)
class NotificationsController extends AsyncNotifier<NotificationsState> {
  ApiClient get _api => ref.read(apiClientProvider);

  @override
  Future<NotificationsState> build() => _load();

  Future<NotificationsState> _load() async {
    final json = await _api.getJson(
      '/notifications',
      query: {'limit': AppConfig.pageSize},
    );
    final page = Paginated<NotificationItem>.fromJson(
      json,
      NotificationItem.fromJson,
    );
    return NotificationsState(
      items: page.data,
      unreadCount: page.unreadCount ??
          page.data.where((n) => !n.isRead).length,
    );
  }

  /// Pull-to-refresh: reload without flipping the whole screen to a spinner.
  Future<void> refresh() async {
    state = await AsyncValue.guard(_load);
  }

  /// Mark a single notification as read (optimistic). Safe to call on an
  /// already-read item — it is a no-op then.
  Future<void> markRead(String id) async {
    final current = state.valueOrNull;
    if (current == null) return;
    final target = current.items
        .where((n) => n.id == id && !n.isRead)
        .cast<NotificationItem?>()
        .firstWhere((_) => true, orElse: () => null);
    if (target == null) return;

    final nowIso = DateTime.now().toUtc().toIso8601String();
    final updated = current.items
        .map((n) => n.id == id
            ? NotificationItem(
                id: n.id,
                type: n.type,
                payload: n.payload,
                readAt: nowIso,
                createdAt: n.createdAt,
              )
            : n)
        .toList();
    final nextUnread = (current.unreadCount - 1).clamp(0, 1 << 30);
    state = AsyncData(
      current.copyWith(items: updated, unreadCount: nextUnread),
    );

    try {
      await _api.postJson(
        '/notifications/read',
        body: {
          'notification_ids': [id],
        },
      );
    } catch (_) {
      // Roll back on failure.
      state = AsyncData(current);
      rethrow;
    }
  }

  /// Mark everything as read (empty array = all, per contract). Optimistic.
  Future<void> markAllRead() async {
    final current = state.valueOrNull;
    if (current == null || current.unreadCount == 0) return;

    final nowIso = DateTime.now().toUtc().toIso8601String();
    final updated = current.items
        .map((n) => n.isRead
            ? n
            : NotificationItem(
                id: n.id,
                type: n.type,
                payload: n.payload,
                readAt: nowIso,
                createdAt: n.createdAt,
              ))
        .toList();
    state = AsyncData(current.copyWith(items: updated, unreadCount: 0));

    try {
      await _api.postJson(
        '/notifications/read',
        body: {'notification_ids': <String>[]},
      );
    } catch (_) {
      state = AsyncData(current);
      rethrow;
    }
  }
}

final notificationsControllerProvider =
    AsyncNotifierProvider<NotificationsController, NotificationsState>(
  NotificationsController.new,
);
