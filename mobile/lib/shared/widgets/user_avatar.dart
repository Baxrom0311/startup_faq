import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../core/theme.dart';

/// Circular avatar showing initials over a role-tinted background,
/// or a network image when [imageUrl] is provided.
class UserAvatar extends StatelessWidget {
  const UserAvatar({
    super.key,
    this.name,
    this.role,
    this.imageUrl,
    this.radius = 20,
  });

  final String? name;
  final AppRole? role;
  final String? imageUrl;
  final double radius;

  String get _initials {
    final n = (name ?? '').trim();
    if (n.isEmpty) return '?';
    final parts = n.split(RegExp(r'\s+'));
    if (parts.length == 1) {
      return parts.first.characters.take(2).toString().toUpperCase();
    }
    return (parts.first.characters.first + parts[1].characters.first)
        .toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final color = role?.color(c) ?? c.brand;

    if (imageUrl != null && imageUrl!.isNotEmpty) {
      return CircleAvatar(
        radius: radius,
        backgroundColor: color.withValues(alpha: 0.14),
        backgroundImage: CachedNetworkImageProvider(imageUrl!),
      );
    }

    return CircleAvatar(
      radius: radius,
      backgroundColor: color.withValues(alpha: 0.16),
      child: Text(
        _initials,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w700,
          fontSize: radius * 0.72,
        ),
      ),
    );
  }
}
