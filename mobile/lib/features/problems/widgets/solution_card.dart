import 'package:flutter/material.dart';

import '../../../core/theme.dart';
import '../../../models/models.dart';
import '../../../shared/widgets/widgets.dart';
import 'chat_message.dart';

/// A highlighted gold "Yechim taklifi" (solution proposal) card, derived from a
/// [Project]. Startups post these into the discussion; citizens and others can
/// tap "Qo'shilaman" to signal they want to collaborate.
class SolutionCard extends StatelessWidget {
  const SolutionCard({
    super.key,
    required this.project,
    required this.onJoin,
    this.joining = false,
  });

  final Project project;

  /// Called when the user taps "Qo'shilaman".
  final VoidCallback onJoin;
  final bool joining;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final gold = c.gold;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              gold.withValues(alpha: 0.16),
              gold.withValues(alpha: 0.06),
            ],
          ),
          borderRadius: BorderRadius.circular(AppTheme.radiusLg),
          border: Border.all(color: gold.withValues(alpha: 0.45), width: 1.4),
        ),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: gold.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                  ),
                  child: Icon(Icons.lightbulb_rounded, color: gold, size: 20),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Yechim taklifi',
                        style: TextStyle(
                          color: gold,
                          fontWeight: FontWeight.w800,
                          fontSize: 12,
                          letterSpacing: 0.3,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        project.title,
                        style: TextStyle(
                          color: c.ink,
                          fontWeight: FontWeight.w700,
                          fontSize: 16,
                          height: 1.25,
                        ),
                      ),
                    ],
                  ),
                ),
                const RoleBadge(role: AppRole.startup),
              ],
            ),
            if (project.pitch != null && project.pitch!.trim().isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(
                project.pitch!.trim(),
                style: TextStyle(color: c.ink, height: 1.4, fontSize: 14),
              ),
            ],
            const SizedBox(height: 12),
            Row(
              children: [
                StatusChip(status: project.status, dense: true),
                const Spacer(),
                Text(
                  formatTimeAgo(project.createdAt),
                  style: TextStyle(
                    color: c.muted,
                    fontSize: 11,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: AppButton(
                label: "Qo'shilaman",
                variant: AppButtonVariant.gold,
                icon: Icons.group_add_rounded,
                loading: joining,
                onPressed: onJoin,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
