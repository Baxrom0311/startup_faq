import 'package:flutter/material.dart';

import '../../../core/theme.dart';

/// A single selectable option displayed in [showOptionPicker].
class PickerOption<T> {
  const PickerOption({required this.value, required this.label, this.subtitle});

  final T value;
  final String label;
  final String? subtitle;
}

/// A tappable field that shows the current [valueLabel] (or [hint] when empty)
/// and opens a picker sheet. Clearly marked optional by the caller.
class OptionPickerField extends StatelessWidget {
  const OptionPickerField({
    super.key,
    required this.icon,
    required this.label,
    required this.valueLabel,
    required this.hint,
    required this.onTap,
    this.onClear,
  });

  final IconData icon;
  final String label;
  final String? valueLabel;
  final String hint;
  final VoidCallback onTap;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final hasValue = valueLabel != null && valueLabel!.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(color: c.muted, fontSize: 12, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 6),
        InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppTheme.radius),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            decoration: BoxDecoration(
              color: c.surface,
              borderRadius: BorderRadius.circular(AppTheme.radius),
              border: Border.all(color: c.line),
            ),
            child: Row(
              children: [
                Icon(icon, size: 20, color: hasValue ? c.brand : c.muted),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    hasValue ? valueLabel! : hint,
                    style: TextStyle(
                      color: hasValue ? c.ink : c.muted,
                      fontWeight: hasValue ? FontWeight.w600 : FontWeight.w400,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (hasValue && onClear != null)
                  GestureDetector(
                    onTap: onClear,
                    child: Icon(Icons.close_rounded, size: 20, color: c.muted),
                  )
                else
                  Icon(Icons.expand_more_rounded, color: c.muted),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// Opens a searchable bottom sheet to pick one option. Returns null on dismiss.
Future<T?> showOptionPicker<T>(
  BuildContext context, {
  required String title,
  required List<PickerOption<T>> options,
}) {
  final c = AppColors.of(context);
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    backgroundColor: c.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppTheme.radiusLg)),
    ),
    builder: (ctx) => _OptionPickerSheet<T>(title: title, options: options),
  );
}

class _OptionPickerSheet<T> extends StatefulWidget {
  const _OptionPickerSheet({required this.title, required this.options});

  final String title;
  final List<PickerOption<T>> options;

  @override
  State<_OptionPickerSheet<T>> createState() => _OptionPickerSheetState<T>();
}

class _OptionPickerSheetState<T> extends State<_OptionPickerSheet<T>> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final q = _query.trim().toLowerCase();
    final filtered = q.isEmpty
        ? widget.options
        : widget.options
            .where((o) => o.label.toLowerCase().contains(q))
            .toList();

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.7,
        minChildSize: 0.4,
        maxChildSize: 0.92,
        builder: (ctx, scrollController) => Column(
          children: [
            const SizedBox(height: 10),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: c.line,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      widget.title,
                      style: TextStyle(
                        color: c.ink,
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(ctx).pop(),
                    icon: Icon(Icons.close_rounded, color: c.muted),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                autofocus: false,
                onChanged: (v) => setState(() => _query = v),
                decoration: InputDecoration(
                  hintText: 'Qidirish…',
                  prefixIcon: Icon(Icons.search_rounded, color: c.muted),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: filtered.isEmpty
                  ? Center(
                      child: Text('Topilmadi', style: TextStyle(color: c.muted)),
                    )
                  : ListView.builder(
                      controller: scrollController,
                      itemCount: filtered.length,
                      itemBuilder: (ctx, i) {
                        final o = filtered[i];
                        return ListTile(
                          title: Text(o.label),
                          subtitle: o.subtitle == null ? null : Text(o.subtitle!),
                          onTap: () => Navigator.of(ctx).pop(o.value),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
