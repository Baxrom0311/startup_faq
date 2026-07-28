import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router.dart';
import '../../../core/theme.dart';
import '../../../models/models.dart';
import '../../../shared/widgets/widgets.dart';

/// Friendly "we found a similar problem" bottom sheet. Offers opening the
/// existing problem's live discussion instead of creating a duplicate.
Future<void> showDuplicateSheet(
  BuildContext context, {
  required Problem duplicate,
}) {
  final c = AppColors.of(context);
  final targetId = duplicate.duplicateOf ?? duplicate.id;

  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: c.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppTheme.radiusLg)),
    ),
    builder: (ctx) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: c.gold.withValues(alpha: 0.14),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.lightbulb_outline_rounded, color: c.gold),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'O‘xshash muammo topildi',
                    style: TextStyle(
                      color: c.ink,
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              'Bunga o‘xshash muammo allaqachon mavjud. Yangi yaratish o‘rniga '
              'unga qo‘shilib, ovoz bering yoki fikr bildiring — birgalikda '
              'tezroq yechim topiladi.',
              style: TextStyle(color: c.muted, height: 1.4),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: c.bg,
                borderRadius: BorderRadius.circular(AppTheme.radius),
                border: Border.all(color: c.line),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      duplicate.title?.trim().isNotEmpty == true
                          ? duplicate.title!
                          : (duplicate.rawText?.trim().isNotEmpty == true
                              ? duplicate.rawText!
                              : 'Mavjud muammo'),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: c.ink, fontWeight: FontWeight.w600),
                    ),
                  ),
                  const SizedBox(width: 8),
                  StatusChip(status: duplicate.status, dense: true),
                ],
              ),
            ),
            const SizedBox(height: 20),
            AppButton(
              label: 'Muammoni ochish',
              icon: Icons.arrow_forward_rounded,
              onPressed: () {
                Navigator.of(ctx).pop();
                context.go(Routes.problem(targetId));
              },
            ),
            const SizedBox(height: 10),
            AppButton(
              label: 'Yopish',
              variant: AppButtonVariant.outline,
              onPressed: () => Navigator.of(ctx).pop(),
            ),
          ],
        ),
      ),
    ),
  );
}

/// Full-screen success confirmation shown after a problem is accepted.
class SubmitSuccessView extends StatelessWidget {
  const SubmitSuccessView({super.key, required this.onDone});

  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 96,
              height: 96,
              decoration: BoxDecoration(
                color: c.green.withValues(alpha: 0.14),
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.check_rounded, color: c.green, size: 56),
            ),
            const SizedBox(height: 24),
            Text(
              'Rahmat!',
              style: TextStyle(
                color: c.ink,
                fontSize: 24,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              'Muammongiz qabul qilindi. Tez orada ko‘rib chiqamiz va sun’iy '
              'intellekt uni tegishli sohaga biriktiradi. Muhokamani kuzatib '
              'boring — startaplar yechim taklif qilishi mumkin.',
              textAlign: TextAlign.center,
              style: TextStyle(color: c.muted, height: 1.5),
            ),
            const SizedBox(height: 28),
            AppButton(
              label: 'Bosh sahifaga',
              icon: Icons.home_rounded,
              onPressed: onDone,
            ),
          ],
        ),
      ),
    );
  }
}
