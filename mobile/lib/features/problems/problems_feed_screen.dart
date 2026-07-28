import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import 'providers/problems_providers.dart';
import 'widgets/problem_card.dart';

/// The main home feed: a clean, scrollable list of problem cards with sector /
/// region filters, a newest/popular sort toggle, a "my problems" toggle,
/// pull-to-refresh, infinite scroll, and a prominent "Muammo yuborish" FAB.
class ProblemsFeedScreen extends ConsumerStatefulWidget {
  const ProblemsFeedScreen({super.key});

  @override
  ConsumerState<ProblemsFeedScreen> createState() => _ProblemsFeedScreenState();
}

class _ProblemsFeedScreenState extends ConsumerState<ProblemsFeedScreen> {
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scroll
      ..removeListener(_onScroll)
      ..dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scroll.hasClients) return;
    final threshold = _scroll.position.maxScrollExtent - 400;
    if (_scroll.position.pixels >= threshold) {
      ref.read(problemsFeedProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final state = ref.watch(problemsFeedProvider);

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 20,
        title: const Text('Muammolar'),
        actions: [
          IconButton(
            tooltip: 'Yangilash',
            onPressed: () => ref.read(problemsFeedProvider.notifier).refresh(),
            icon: const Icon(Icons.refresh_rounded),
          ),
          const SizedBox(width: 4),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push(Routes.submit),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Muammo yuborish'),
      ),
      body: Column(
        children: [
          _FilterBar(state: state),
          Expanded(child: _body(context, c, state)),
        ],
      ),
    );
  }

  Widget _body(BuildContext context, AppColors c, ProblemsFeedState state) {
    if (state.loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (state.error != null && state.items.isEmpty) {
      return _ErrorView(
        message: state.error!,
        onRetry: () => ref.read(problemsFeedProvider.notifier).load(),
      );
    }
    if (state.isEmpty) {
      return _EmptyView(hasFilters: state.hasFilters);
    }

    final sectors = ref.watch(sectorsProvider).valueOrNull ?? const <Sector>[];
    final regions = ref.watch(regionsProvider).valueOrNull ?? const <Region>[];
    final sectorById = {for (final s in sectors) s.id: s};
    final regionById = {for (final r in regions) r.id: r};

    return RefreshIndicator(
      onRefresh: () => ref.read(problemsFeedProvider.notifier).refresh(),
      child: ListView.separated(
        controller: _scroll,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
        itemCount: state.items.length + (state.loadingMore ? 1 : 0),
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (context, i) {
          if (i >= state.items.length) {
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: 20),
              child: Center(child: CircularProgressIndicator()),
            );
          }
          final p = state.items[i];
          return ProblemCard(
            problem: p,
            sector: p.sectorId != null ? sectorById[p.sectorId] : null,
            region: p.regionId != null ? regionById[p.regionId] : null,
            onTap: () => context.push(Routes.problem(p.id)),
            onVote: () =>
                ref.read(problemsFeedProvider.notifier).toggleVote(p.id),
          );
        },
      ),
    );
  }
}

/// Horizontally scrollable filter row: sort toggle, sector, region, and a
/// "my problems" toggle.
class _FilterBar extends ConsumerWidget {
  const _FilterBar({required this.state});

  final ProblemsFeedState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = AppColors.of(context);
    final notifier = ref.read(problemsFeedProvider.notifier);
    final sectors = ref.watch(sectorsProvider).valueOrNull ?? const <Sector>[];
    final regions = ref.watch(regionsProvider).valueOrNull ?? const <Region>[];
    Sector? sector;
    for (final s in sectors) {
      if (s.id == state.sectorId) {
        sector = s;
        break;
      }
    }
    Region? region;
    for (final r in regions) {
      if (r.id == state.regionId) {
        region = r;
        break;
      }
    }

    return Container(
      decoration: BoxDecoration(
        color: c.bg,
        border: Border(bottom: BorderSide(color: c.line)),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        child: Row(
          children: [
            _SortToggle(
              sort: state.sort,
              onChanged: notifier.setSort,
            ),
            const SizedBox(width: 10),
            _FilterChip(
              label: sector?.nameUz ?? 'Soha',
              icon: Icons.category_outlined,
              active: sector != null,
              onTap: () => _pickSector(context, ref, sectors),
              onClear: sector != null ? () => notifier.setSector(null) : null,
            ),
            const SizedBox(width: 8),
            _FilterChip(
              label: region?.name ?? 'Hudud',
              icon: Icons.place_outlined,
              active: region != null,
              onTap: () => _pickRegion(context, ref, regions),
              onClear: region != null ? () => notifier.setRegion(null) : null,
            ),
            const SizedBox(width: 8),
            _FilterChip(
              label: 'Mening muammolarim',
              icon: Icons.person_outline_rounded,
              active: state.mine,
              onTap: () => notifier.setMine(!state.mine),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickSector(
    BuildContext context,
    WidgetRef ref,
    List<Sector> sectors,
  ) async {
    if (sectors.isEmpty) return;
    final selected = await _showPicker<int>(
      context: context,
      title: 'Sohani tanlang',
      current: state.sectorId,
      options: [
        for (final s in sectors)
          _PickerOption(
            value: s.id,
            label: s.nameUz,
            leading: (s.icon ?? '').trim().isNotEmpty ? s.icon!.trim() : null,
          ),
      ],
    );
    if (selected != null) {
      ref.read(problemsFeedProvider.notifier).setSector(selected.orNull);
    }
  }

  Future<void> _pickRegion(
    BuildContext context,
    WidgetRef ref,
    List<Region> regions,
  ) async {
    if (regions.isEmpty) return;
    final selected = await _showPicker<int>(
      context: context,
      title: 'Hududni tanlang',
      current: state.regionId,
      options: [
        for (final r in regions) _PickerOption(value: r.id, label: r.name),
      ],
    );
    if (selected != null) {
      ref.read(problemsFeedProvider.notifier).setRegion(selected.orNull);
    }
  }
}

/// Segmented newest / popular toggle.
class _SortToggle extends StatelessWidget {
  const _SortToggle({required this.sort, required this.onChanged});

  final FeedSort sort;
  final ValueChanged<FeedSort> onChanged;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: c.line),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (final s in FeedSort.values) _segment(context, c, s),
        ],
      ),
    );
  }

  Widget _segment(BuildContext context, AppColors c, FeedSort s) {
    final selected = s == sort;
    return GestureDetector(
      onTap: () => onChanged(s),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: selected ? c.brand : Colors.transparent,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              s == FeedSort.newest
                  ? Icons.schedule_rounded
                  : Icons.local_fire_department_rounded,
              size: 15,
              color: selected ? Colors.white : c.muted,
            ),
            const SizedBox(width: 5),
            Text(
              s.labelUz,
              style: TextStyle(
                color: selected ? Colors.white : c.muted,
                fontWeight: FontWeight.w700,
                fontSize: 12.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Pill filter chip with an optional trailing clear button.
class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.icon,
    required this.active,
    required this.onTap,
    this.onClear,
  });

  final String label;
  final IconData icon;
  final bool active;
  final VoidCallback onTap;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final color = active ? c.brand : c.muted;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: EdgeInsets.only(left: 12, right: onClear != null ? 6 : 12),
        height: 38,
        decoration: BoxDecoration(
          color: active ? c.brand.withValues(alpha: 0.12) : c.surface,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: active ? c.brand.withValues(alpha: 0.45) : c.line,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: active ? c.brand : c.ink,
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
            ),
            if (onClear != null)
              GestureDetector(
                onTap: onClear,
                child: Padding(
                  padding: const EdgeInsets.only(left: 4),
                  child: Icon(Icons.close_rounded, size: 16, color: color),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ---- Picker bottom sheet ------------------------------------------------

class _PickerOption<T> {
  const _PickerOption({required this.value, required this.label, this.leading});
  final T value;
  final String label;

  /// Optional emoji shown before the label.
  final String? leading;
}

/// Wrapper so a picker can distinguish "dismissed" (null) from "cleared"
/// (a real selection of no filter).
class _Selection<T> {
  const _Selection(this.value);
  final T? value;
  T? get orNull => value;
}

Future<_Selection<T>?> _showPicker<T>({
  required BuildContext context,
  required String title,
  required T? current,
  required List<_PickerOption<T>> options,
}) {
  final c = AppColors.of(context);
  return showModalBottomSheet<_Selection<T>>(
    context: context,
    backgroundColor: c.surface,
    showDragHandle: true,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppTheme.radiusLg)),
    ),
    builder: (context) {
      return SafeArea(
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(context).size.height * 0.7,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
                child: Text(
                  title,
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              ListTile(
                leading: Icon(Icons.clear_all_rounded, color: c.muted),
                title: const Text('Hammasi'),
                trailing: current == null
                    ? Icon(Icons.check_rounded, color: c.brand)
                    : null,
                onTap: () =>
                    Navigator.of(context).pop(const _Selection(null)),
              ),
              const Divider(height: 1),
              Flexible(
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: options.length,
                  itemBuilder: (context, i) {
                    final o = options[i];
                    final selected = o.value == current;
                    return ListTile(
                      leading: o.leading != null
                          ? Text(o.leading!, style: const TextStyle(fontSize: 20))
                          : null,
                      title: Text(o.label),
                      trailing: selected
                          ? Icon(Icons.check_rounded, color: c.brand)
                          : null,
                      onTap: () =>
                          Navigator.of(context).pop(_Selection<T>(o.value)),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}

// ---- Empty / error states ----------------------------------------------

class _EmptyView extends StatelessWidget {
  const _EmptyView({required this.hasFilters});

  final bool hasFilters;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return LayoutBuilder(
      builder: (context, constraints) => SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: constraints.maxHeight),
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.inbox_rounded, size: 56, color: c.muted),
                  const SizedBox(height: 16),
                  Text(
                    hasFilters
                        ? 'Ushbu filtrlar bo‘yicha muammo topilmadi'
                        : 'Hozircha muammolar yo‘q',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    hasFilters
                        ? 'Filtrlarni o‘zgartirib ko‘ring.'
                        : 'Birinchi bo‘lib muammo yuboring.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context)
                        .textTheme
                        .bodyMedium
                        ?.copyWith(color: c.muted),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.wifi_off_rounded, size: 56, color: c.muted),
            const SizedBox(height: 16),
            Text(
              message,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Qayta urinish'),
            ),
          ],
        ),
      ),
    );
  }
}
