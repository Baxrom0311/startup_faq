import 'json_utils.dart';

/// Generic wrapper for the backend's `{data: [...], count: n}` envelope.
class Paginated<T> {
  const Paginated({
    required this.data,
    required this.count,
    this.unreadCount,
  });

  final List<T> data;
  final int count;

  /// Only present on the notifications endpoint.
  final int? unreadCount;

  factory Paginated.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) itemFromJson,
  ) {
    final raw = json['data'];
    final items = raw is List
        ? raw
            .whereType<Map>()
            .map((e) => itemFromJson(Map<String, dynamic>.from(e)))
            .toList()
        : <T>[];
    return Paginated<T>(
      data: items,
      count: J.intv(json['count'], items.length),
      unreadCount: J.intOrNull(json['unread_count']),
    );
  }
}
