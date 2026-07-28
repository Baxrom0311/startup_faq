import 'package:flutter/material.dart';

import '../../core/theme.dart';

/// Small colored pill marking an author's role.
/// Owner = blue, Citizen = green, Startup = gold.
class RoleBadge extends StatelessWidget {
  const RoleBadge({
    super.key,
    required this.role,
    this.label,
    this.dense = false,
  });

  final AppRole role;

  /// Overrides the default Uzbek role label.
  final String? label;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final color = role.color(c);
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: dense ? 6 : 8,
        vertical: dense ? 2 : 3,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(
        label ?? role.labelUz,
        style: TextStyle(
          color: color,
          fontSize: dense ? 10 : 11,
          fontWeight: FontWeight.w700,
          height: 1.1,
        ),
      ),
    );
  }
}
