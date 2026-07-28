import 'package:flutter/material.dart';

import '../../../core/theme.dart';
import '../../../models/models.dart';
import '../../../shared/widgets/widgets.dart';

/// A single discussion message rendered as a chat bubble.
///
/// Layout is group-chat style: an avatar + name + [RoleBadge] + timestamp,
/// with the message text in a rounded, role-tinted bubble. The viewer's own
/// messages are right-aligned and highlighted.
class ChatMessage extends StatelessWidget {
  const ChatMessage({
    super.key,
    required this.comment,
    required this.role,
    required this.isMine,
  });

  final Comment comment;
  final AppRole role;
  final bool isMine;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final roleColor = role.color(c);
    final name = (comment.authorName?.trim().isNotEmpty ?? false)
        ? comment.authorName!.trim()
        : 'Foydalanuvchi';

    final bubbleColor = isMine
        ? c.brand.withValues(alpha: 0.12)
        : c.surface;
    final borderColor = isMine
        ? c.brand.withValues(alpha: 0.30)
        : c.line;

    final bubble = Container(
      constraints: BoxConstraints(
        maxWidth: MediaQuery.of(context).size.width * 0.74,
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: bubbleColor,
        borderRadius: BorderRadius.only(
          topLeft: const Radius.circular(AppTheme.radius),
          topRight: const Radius.circular(AppTheme.radius),
          bottomLeft: Radius.circular(isMine ? AppTheme.radius : 4),
          bottomRight: Radius.circular(isMine ? 4 : AppTheme.radius),
        ),
        border: Border.all(color: borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Flexible(
                child: Text(
                  name,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: roleColor,
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
              ),
              const SizedBox(width: 6),
              RoleBadge(role: role, dense: true),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            comment.text,
            style: TextStyle(color: c.ink, height: 1.35, fontSize: 15),
          ),
          const SizedBox(height: 4),
          Text(
            formatTimeAgo(comment.createdAt),
            style: TextStyle(
              color: c.muted,
              fontSize: 11,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );

    final avatar = UserAvatar(name: name, role: role, radius: 18);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment:
            isMine ? MainAxisAlignment.end : MainAxisAlignment.start,
        children: isMine
            ? [Flexible(child: Align(alignment: Alignment.centerRight, child: bubble)), const SizedBox(width: 8), avatar]
            : [avatar, const SizedBox(width: 8), Flexible(child: bubble)],
      ),
    );
  }
}

/// Formats an ISO-8601 timestamp into a short Uzbek relative label.
String formatTimeAgo(String iso) {
  final dt = DateTime.tryParse(iso);
  if (dt == null) return '';
  final now = DateTime.now();
  final diff = now.difference(dt.isUtc ? dt.toLocal() : dt);

  if (diff.inSeconds < 60) return 'hozir';
  if (diff.inMinutes < 60) return '${diff.inMinutes} daq oldin';
  if (diff.inHours < 24) return '${diff.inHours} soat oldin';
  if (diff.inDays < 7) return '${diff.inDays} kun oldin';

  final local = dt.isUtc ? dt.toLocal() : dt;
  final dd = local.day.toString().padLeft(2, '0');
  final mm = local.month.toString().padLeft(2, '0');
  return '$dd.$mm.${local.year}';
}
