import 'package:flutter/material.dart';

import '../../../core/theme.dart';
import '../../../models/models.dart';
import '../../../shared/widgets/widgets.dart';

/// A premium, tappable card summarizing a single [Problem] in the feed.
///
/// Presentational only — the caller resolves [sector]/[region] from the
/// lookup providers and owns the [onTap] / [onVote] callbacks.
class ProblemCard extends StatelessWidget {
  const ProblemCard({
    super.key,
    required this.problem,
    this.sector,
    this.region,
    required this.onTap,
    required this.onVote,
  });

  final Problem problem;
  final Sector? sector;
  final Region? region;
  final VoidCallback onTap;
  final VoidCallback onVote;

  String get _summary {
    final t = (problem.rawText ?? '').trim();
    if (t.isNotEmpty) return t;
    final struct = problem.structuredDesc;
    final s = struct?['summary'] ?? struct?['description'];
    if (s is String && s.trim().isNotEmpty) return s.trim();
    return '';
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final text = Theme.of(context).textTheme;
    final title = (problem.title ?? '').trim();
    final summary = _summary;

    return Material(
      color: c.surface,
      borderRadius: BorderRadius.circular(AppTheme.radius),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppTheme.radius),
        child: Ink(
          decoration: BoxDecoration(
            color: c.surface,
            borderRadius: BorderRadius.circular(AppTheme.radius),
            border: Border.all(color: c.line),
            boxShadow: [
              BoxShadow(
                color: c.ink.withValues(alpha: 0.04),
                blurRadius: 14,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Status + sector/region meta row.
              Row(
                children: [
                  StatusChip(status: problem.status, dense: true),
                  const SizedBox(width: 8),
                  Expanded(child: _meta(context, c, text)),
                ],
              ),
              const SizedBox(height: 10),

              // Title.
              if (title.isNotEmpty)
                Text(
                  title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: text.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    height: 1.25,
                    color: c.ink,
                  ),
                ),

              // 2-line summary.
              if (summary.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  summary,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: text.bodyMedium?.copyWith(
                    color: c.muted,
                    height: 1.35,
                  ),
                ),
              ],

              // Voice indicator.
              if (problem.rawAudioKey != null &&
                  problem.rawAudioKey!.isNotEmpty) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    Icon(Icons.graphic_eq_rounded, size: 16, color: c.brand),
                    const SizedBox(width: 6),
                    Text(
                      'Ovozli muammo',
                      style: text.labelMedium?.copyWith(color: c.brand),
                    ),
                  ],
                ),
              ],

              const SizedBox(height: 12),
              Divider(height: 1, color: c.line),
              const SizedBox(height: 10),

              // Author + counts row.
              Row(
                children: [
                  UserAvatar(
                    name: problem.authorName,
                    role: AppRole.owner,
                    radius: 15,
                  ),
                  const SizedBox(width: 8),
                  Flexible(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          (problem.authorName ?? '').trim().isEmpty
                              ? 'Fuqaro'
                              : problem.authorName!.trim(),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: text.labelLarge?.copyWith(
                            fontWeight: FontWeight.w600,
                            color: c.ink,
                          ),
                        ),
                        Text(
                          _timeAgo(problem.createdAt),
                          style: text.labelSmall?.copyWith(color: c.muted),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 6),
                  const RoleBadge(role: AppRole.owner, dense: true),
                  const SizedBox(width: 8),
                  _counts(context, c, text),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _meta(BuildContext context, AppColors c, TextTheme text) {
    final parts = <Widget>[];
    if (sector != null) {
      final icon = (sector!.icon ?? '').trim();
      parts.add(
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(right: 4),
                child: Text(icon, style: const TextStyle(fontSize: 13)),
              )
            else
              Padding(
                padding: const EdgeInsets.only(right: 4),
                child: Icon(Icons.category_outlined, size: 13, color: c.muted),
              ),
            Flexible(
              child: Text(
                sector!.nameUz,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: text.labelMedium?.copyWith(color: c.muted),
              ),
            ),
          ],
        ),
      );
    }
    if (region != null) {
      parts.add(
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.place_outlined, size: 13, color: c.muted),
            const SizedBox(width: 2),
            Flexible(
              child: Text(
                region!.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: text.labelMedium?.copyWith(color: c.muted),
              ),
            ),
          ],
        ),
      );
    }
    if (parts.isEmpty) return const SizedBox.shrink();

    return Wrap(
      alignment: WrapAlignment.end,
      spacing: 10,
      runSpacing: 2,
      children: parts,
    );
  }

  Widget _counts(BuildContext context, AppColors c, TextTheme text) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _VoteChip(
          count: problem.voteCount,
          active: problem.hasVoted,
          onTap: onVote,
        ),
        const SizedBox(width: 12),
        _CountStat(
          icon: Icons.forum_outlined,
          count: problem.commentCount,
          color: c.muted,
        ),
        const SizedBox(width: 12),
        _CountStat(
          icon: Icons.lightbulb_outline_rounded,
          count: problem.projectCount,
          color: c.gold,
        ),
      ],
    );
  }
}

/// Tappable upvote pill with an active (voted) state.
class _VoteChip extends StatelessWidget {
  const _VoteChip({
    required this.count,
    required this.active,
    required this.onTap,
  });

  final int count;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final color = active ? c.brand : c.muted;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              active
                  ? Icons.arrow_upward_rounded
                  : Icons.arrow_upward_rounded,
              size: 17,
              color: color,
            ),
            const SizedBox(width: 4),
            Text(
              '$count',
              style: TextStyle(
                color: color,
                fontWeight: FontWeight.w700,
                fontSize: 13,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CountStat extends StatelessWidget {
  const _CountStat({
    required this.icon,
    required this.count,
    required this.color,
  });

  final IconData icon;
  final int count;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(width: 4),
        Text(
          '$count',
          style: TextStyle(
            color: color,
            fontWeight: FontWeight.w700,
            fontSize: 13,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
      ],
    );
  }
}

/// Compact Uzbek relative-time from an ISO-8601 [iso] timestamp.
String _timeAgo(String iso) {
  final dt = DateTime.tryParse(iso);
  if (dt == null) return '';
  final now = DateTime.now();
  final diff = now.difference(dt.toLocal());
  if (diff.inSeconds < 60) return 'hozir';
  if (diff.inMinutes < 60) return '${diff.inMinutes} daq oldin';
  if (diff.inHours < 24) return '${diff.inHours} soat oldin';
  if (diff.inDays < 7) return '${diff.inDays} kun oldin';
  if (diff.inDays < 30) return '${(diff.inDays / 7).floor()} hafta oldin';
  if (diff.inDays < 365) return '${(diff.inDays / 30).floor()} oy oldin';
  return '${(diff.inDays / 365).floor()} yil oldin';
}
