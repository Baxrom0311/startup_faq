import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api_client.dart';
import '../../../core/config.dart';
import '../../../models/models.dart';

/// Sort order for the problems feed.
enum FeedSort { newest, popular }

extension FeedSortApi on FeedSort {
  String get apiValue => switch (this) {
        FeedSort.newest => 'newest',
        FeedSort.popular => 'popular',
      };

  String get labelUz => switch (this) {
        FeedSort.newest => 'Yangi',
        FeedSort.popular => 'Ommabop',
      };
}

/// All sectors (for the filter picker). `/sectors/` returns a bare array.
final sectorsProvider = FutureProvider<List<Sector>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final res = await api.raw.get<dynamic>('/sectors/');
  return _parseList(res.data, Sector.fromJson);
});

/// All regions (for the filter picker). `/regions/` returns a bare array.
final regionsProvider = FutureProvider<List<Region>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final res = await api.raw.get<dynamic>('/regions/');
  return _parseList(res.data, Region.fromJson);
});

List<T> _parseList<T>(dynamic data, T Function(Map<String, dynamic>) from) {
  // Tolerate both a bare list and the `{data: [...]}` envelope.
  final raw = data is Map ? data['data'] : data;
  if (raw is List) {
    return raw
        .whereType<Map>()
        .map((e) => from(Map<String, dynamic>.from(e)))
        .toList();
  }
  return <T>[];
}

/// Immutable state for the problems feed.
class ProblemsFeedState {
  const ProblemsFeedState({
    this.items = const [],
    this.loading = true,
    this.loadingMore = false,
    this.refreshing = false,
    this.hasMore = true,
    this.error,
    this.sectorId,
    this.regionId,
    this.sort = FeedSort.newest,
    this.mine = false,
  });

  final List<Problem> items;

  /// Initial (blocking) load — show a full-screen spinner.
  final bool loading;

  /// Appending the next page.
  final bool loadingMore;

  /// Pull-to-refresh in flight.
  final bool refreshing;

  /// Whether more pages remain.
  final bool hasMore;

  /// Error message for the initial load (null when items are shown).
  final String? error;

  // ---- Active filters ----
  final int? sectorId;
  final int? regionId;
  final FeedSort sort;
  final bool mine;

  bool get isEmpty => !loading && error == null && items.isEmpty;

  bool get hasFilters => sectorId != null || regionId != null || mine;

  ProblemsFeedState copyWith({
    List<Problem>? items,
    bool? loading,
    bool? loadingMore,
    bool? refreshing,
    bool? hasMore,
    Object? error = _noChange,
    Object? sectorId = _noChange,
    Object? regionId = _noChange,
    FeedSort? sort,
    bool? mine,
  }) {
    return ProblemsFeedState(
      items: items ?? this.items,
      loading: loading ?? this.loading,
      loadingMore: loadingMore ?? this.loadingMore,
      refreshing: refreshing ?? this.refreshing,
      hasMore: hasMore ?? this.hasMore,
      error: error == _noChange ? this.error : error as String?,
      sectorId: sectorId == _noChange ? this.sectorId : sectorId as int?,
      regionId: regionId == _noChange ? this.regionId : regionId as int?,
      sort: sort ?? this.sort,
      mine: mine ?? this.mine,
    );
  }

  static const _noChange = Object();
}

/// Drives the paginated problems feed: initial load, pull-to-refresh,
/// infinite scroll, filter changes, and optimistic voting.
class ProblemsFeedController extends StateNotifier<ProblemsFeedState> {
  ProblemsFeedController(this._api) : super(const ProblemsFeedState()) {
    load();
  }

  final ApiClient _api;

  static const _limit = AppConfig.pageSize;

  Future<Map<String, dynamic>> _query(int skip) async {
    final q = <String, dynamic>{
      'sort': state.sort.apiValue,
      'skip': skip,
      'limit': _limit,
    };
    // When browsing "my problems" show every status; otherwise only published.
    if (state.mine) {
      q['mine'] = true;
    } else {
      q['status'] = 'published';
    }
    if (state.sectorId != null) q['sector_id'] = state.sectorId;
    if (state.regionId != null) q['region_id'] = state.regionId;
    return _api.getJson('/problems/', query: q);
  }

  /// Fresh load using the current filters (used on first build and after a
  /// filter change).
  Future<void> load() async {
    state = state.copyWith(loading: true, error: null);
    try {
      final json = await _query(0);
      final page = Paginated<Problem>.fromJson(json, Problem.fromJson);
      state = state.copyWith(
        items: page.data,
        loading: false,
        refreshing: false,
        error: null,
        hasMore: page.data.length >= _limit,
      );
    } on ApiException catch (e) {
      state = state.copyWith(loading: false, refreshing: false, error: e.message);
    } catch (e) {
      state = state.copyWith(
        loading: false,
        refreshing: false,
        error: 'Kutilmagan xatolik yuz berdi',
      );
    }
  }

  /// Pull-to-refresh — keeps existing items visible while reloading page 0.
  Future<void> refresh() async {
    state = state.copyWith(refreshing: true);
    try {
      final json = await _query(0);
      final page = Paginated<Problem>.fromJson(json, Problem.fromJson);
      state = state.copyWith(
        items: page.data,
        loading: false,
        refreshing: false,
        error: null,
        hasMore: page.data.length >= _limit,
      );
    } on ApiException catch (e) {
      state = state.copyWith(refreshing: false, error: e.message);
    } catch (_) {
      state = state.copyWith(refreshing: false);
    }
  }

  /// Append the next page for infinite scroll.
  Future<void> loadMore() async {
    if (state.loadingMore || !state.hasMore || state.loading) return;
    state = state.copyWith(loadingMore: true);
    try {
      final json = await _query(state.items.length);
      final page = Paginated<Problem>.fromJson(json, Problem.fromJson);
      state = state.copyWith(
        items: [...state.items, ...page.data],
        loadingMore: false,
        hasMore: page.data.length >= _limit,
      );
    } catch (_) {
      // Keep what we have; allow another attempt on the next scroll.
      state = state.copyWith(loadingMore: false);
    }
  }

  // ---- Filters ----------------------------------------------------------

  void setSort(FeedSort sort) {
    if (sort == state.sort) return;
    state = state.copyWith(sort: sort);
    load();
  }

  void setSector(int? sectorId) {
    if (sectorId == state.sectorId) return;
    state = state.copyWith(sectorId: sectorId);
    load();
  }

  void setRegion(int? regionId) {
    if (regionId == state.regionId) return;
    state = state.copyWith(regionId: regionId);
    load();
  }

  void setMine(bool mine) {
    if (mine == state.mine) return;
    state = state.copyWith(mine: mine);
    load();
  }

  void clearFilters() {
    state = state.copyWith(sectorId: null, regionId: null, mine: false);
    load();
  }

  // ---- Voting (optimistic) ---------------------------------------------

  Future<void> toggleVote(String problemId) async {
    final idx = state.items.indexWhere((p) => p.id == problemId);
    if (idx < 0) return;
    final original = state.items[idx];
    final willVote = !original.hasVoted;

    // Optimistic update.
    final optimistic = original.copyWith(
      hasVoted: willVote,
      voteCount: (original.voteCount + (willVote ? 1 : -1)).clamp(0, 1 << 31),
    );
    _replace(idx, optimistic);

    try {
      if (willVote) {
        await _api.send('PUT', '/problems/$problemId/vote');
      } else {
        await _api.delete('/problems/$problemId/vote');
      }
    } catch (_) {
      // Revert on failure.
      final curIdx = state.items.indexWhere((p) => p.id == problemId);
      if (curIdx >= 0) _replace(curIdx, original);
    }
  }

  void _replace(int idx, Problem p) {
    final next = [...state.items];
    next[idx] = p;
    state = state.copyWith(items: next);
  }
}

final problemsFeedProvider =
    StateNotifierProvider<ProblemsFeedController, ProblemsFeedState>((ref) {
  return ProblemsFeedController(ref.watch(apiClientProvider));
});
