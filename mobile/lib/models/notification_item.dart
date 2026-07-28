import 'json_utils.dart';

class NotificationItem {
  const NotificationItem({
    required this.id,
    required this.type,
    required this.payload,
    this.readAt,
    required this.createdAt,
  });

  final String id;
  final String type;
  final Map<String, dynamic> payload;
  final String? readAt;
  final String createdAt;

  bool get isRead => readAt != null && readAt!.isNotEmpty;

  factory NotificationItem.fromJson(Map<String, dynamic> j) => NotificationItem(
        id: J.str(j['id']),
        type: J.str(j['type']),
        payload: J.map(j['payload']),
        readAt: J.strOrNull(j['read_at']),
        createdAt: J.str(j['created_at']),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'type': type,
        'payload': payload,
        'read_at': readAt,
        'created_at': createdAt,
      };
}
