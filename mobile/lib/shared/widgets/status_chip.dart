import 'package:flutter/material.dart';

import '../../core/theme.dart';

/// Colored chip for a problem/project status. Maps known statuses to Uzbek
/// labels and semantic colors; unknown statuses fall back to muted.
class StatusChip extends StatelessWidget {
  const StatusChip({super.key, required this.status, this.dense = false});

  final String status;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final (label, color) = _map(status, c);
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: dense ? 8 : 10,
        vertical: dense ? 3 : 4,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.30)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: dense ? 10 : 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  (String, Color) _map(String s, AppColors c) {
    switch (s) {
      case 'draft':
        return ('Qoralama', c.muted);
      case 'pending':
      case 'in_review':
        return ('Ko‘rib chiqilmoqda', c.gold);
      case 'published':
        return ('Nashr etilgan', c.green);
      case 'in_progress':
        return ('Jarayonda', c.brand);
      case 'solved':
      case 'resolved':
        return ('Hal qilingan', c.green);
      case 'rejected':
      case 'closed':
        return ('Yopilgan', c.muted);
      case 'duplicate':
        return ('Takroriy', c.muted);
      case 'proposed':
        return ('Taklif qilingan', c.gold);
      default:
        return (s, c.muted);
    }
  }
}
