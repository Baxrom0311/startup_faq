import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../models/models.dart';

/// Data + controller providers backing the live "solution chat" on a problem.
///
/// All of these live in the problems feature so they can be evolved without
/// touching `core/`. They read `apiClientProvider` for the network layer.

// ---------------------------------------------------------------------------
// Current user identity (best-effort, decoded from the JWT access token).
//
// The backend contract does not expose a `/me` endpoint, so we derive the
// current user id from the `sub` (or `user_id`) claim of the access token when
// possible. This lets the chat right-align the viewer's own messages. Returns
// null if the token can't be decoded — the UI degrades gracefully.
// ---------------------------------------------------------------------------
final currentUserIdProvider = Provider<String?>((ref) {
  final token = ref.watch(tokenStorageProvider).accessToken;
  return _decodeJwtSubject(token);
});

String? _decodeJwtSubject(String? token) {
  if (token == null || token.isEmpty) return null;
  final parts = token.split('.');
  if (parts.length != 3) return null;
  try {
    var payload = parts[1].replaceAll('-', '+').replaceAll('_', '/');
    switch (payload.length % 4) {
      case 2:
        payload += '==';
        break;
      case 3:
        payload += '=';
        break;
    }
    final decoded = utf8.decode(base64.decode(payload));
    final map = jsonDecode(decoded);
    if (map is Map) {
      final sub = map['sub'] ?? map['user_id'] ?? map['id'];
      return sub?.toString();
    }
  } catch (_) {
    // Malformed token — treat as unknown identity.
  }
  return null;
}

// ---------------------------------------------------------------------------
// Reference data — sectors & regions (for the problem's chips).
// ---------------------------------------------------------------------------
final sectorsProvider = FutureProvider<List<Sector>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final res = await api.raw.get<dynamic>('/sectors/');
  final data = res.data;
  if (data is List) {
    return data
        .whereType<Map>()
        .map((e) => Sector.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }
  return const <Sector>[];
});

final regionsProvider = FutureProvider<List<Region>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final res = await api.raw.get<dynamic>('/regions/');
  final data = res.data;
  if (data is List) {
    return data
        .whereType<Map>()
        .map((e) => Region.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }
  return const <Region>[];
});

// ---------------------------------------------------------------------------
// Problem detail + optimistic voting.
// ---------------------------------------------------------------------------
final problemDetailProvider =
    AsyncNotifierProvider.family<ProblemDetailController, Problem, String>(
  ProblemDetailController.new,
);

class ProblemDetailController extends FamilyAsyncNotifier<Problem, String> {
  @override
  Future<Problem> build(String problemId) async {
    final api = ref.read(apiClientProvider);
    final json = await api.getJson('/problems/$problemId');
    return Problem.fromJson(json);
  }

  /// Toggle the current user's vote with an optimistic UI update.
  Future<void> toggleVote() async {
    final current = state.valueOrNull;
    if (current == null) return;

    final willVote = !current.hasVoted;
    state = AsyncData(
      current.copyWith(
        hasVoted: willVote,
        voteCount: current.voteCount + (willVote ? 1 : -1),
      ),
    );

    final api = ref.read(apiClientProvider);
    try {
      if (willVote) {
        await api.send('PUT', '/problems/${current.id}/vote');
      } else {
        await api.delete('/problems/${current.id}/vote');
      }
    } catch (e) {
      // Revert on failure.
      state = AsyncData(current);
      rethrow;
    }
  }

  /// Silently re-fetch (used by the chat auto-refresh so counts stay live).
  Future<void> refreshQuietly() async {
    try {
      final api = ref.read(apiClientProvider);
      final json = await api.getJson('/problems/$arg');
      state = AsyncData(Problem.fromJson(json));
    } catch (_) {
      // Keep the last good value on transient errors.
    }
  }
}

// ---------------------------------------------------------------------------
// Problem media (photos + audio).
// ---------------------------------------------------------------------------
final problemMediaProvider =
    FutureProvider.family<List<ProblemMedia>, String>((ref, problemId) async {
  final api = ref.watch(apiClientProvider);
  final json = await api.getJson('/problems/$problemId/media');
  return Paginated<ProblemMedia>.fromJson(json, ProblemMedia.fromJson).data;
});

// ---------------------------------------------------------------------------
// Discussion / chat comments with optimistic append + auto-refresh.
// ---------------------------------------------------------------------------
final commentsProvider =
    AsyncNotifierProvider.family<CommentsController, List<Comment>, String>(
  CommentsController.new,
);

class CommentsController extends FamilyAsyncNotifier<List<Comment>, String> {
  @override
  Future<List<Comment>> build(String problemId) => _fetch();

  Future<List<Comment>> _fetch() async {
    final api = ref.read(apiClientProvider);
    final json = await api.getJson('/problems/$arg/comments');
    return Paginated<Comment>.fromJson(json, Comment.fromJson).data;
  }

  /// Silent re-fetch that keeps the current list on error (for polling).
  Future<void> refreshQuietly() async {
    try {
      final fresh = await _fetch();
      state = AsyncData(fresh);
    } catch (_) {
      // Ignore transient polling failures.
    }
  }

  /// Post a message. Appends optimistically, then reconciles with the server
  /// response, deduplicating by id.
  Future<void> send({required String text, String? parentId}) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty) return;

    final api = ref.read(apiClientProvider);
    final json = await api.postJson(
      '/problems/$arg/comments',
      body: {
        'text': trimmed,
        if (parentId != null) 'parent_id': parentId,
      },
    );
    final created = Comment.fromJson(json);
    final current = state.valueOrNull ?? const <Comment>[];
    if (current.any((c) => c.id == created.id)) {
      state = AsyncData(current);
    } else {
      state = AsyncData([...current, created]);
    }
  }
}

// ---------------------------------------------------------------------------
// Solution proposals (projects) with claim + auto-refresh.
// ---------------------------------------------------------------------------
final projectsProvider =
    AsyncNotifierProvider.family<ProjectsController, List<Project>, String>(
  ProjectsController.new,
);

class ProjectsController extends FamilyAsyncNotifier<List<Project>, String> {
  @override
  Future<List<Project>> build(String problemId) => _fetch();

  Future<List<Project>> _fetch() async {
    final api = ref.read(apiClientProvider);
    final json = await api.getJson('/projects', query: {'problem_id': arg});
    return Paginated<Project>.fromJson(json, Project.fromJson).data;
  }

  Future<void> refreshQuietly() async {
    try {
      state = AsyncData(await _fetch());
    } catch (_) {
      // Ignore transient polling failures.
    }
  }

  /// A startup proposes to solve this problem. `repo_url` is intentionally not
  /// required by the product flow.
  Future<Project> claim({required String title, String? pitch}) async {
    final api = ref.read(apiClientProvider);
    final json = await api.postJson(
      '/problems/$arg/claim',
      body: {
        'title': title.trim(),
        if (pitch != null && pitch.trim().isNotEmpty) 'pitch': pitch.trim(),
      },
    );
    final created = Project.fromJson(json);
    final current = state.valueOrNull ?? const <Project>[];
    if (!current.any((p) => p.id == created.id)) {
      state = AsyncData([...current, created]);
    }
    return created;
  }
}

// ---------------------------------------------------------------------------
// Role derivation for color coding.
//
// The problem author is the owner (blue); anyone who leads a solution proposal
// is a startup (gold); everyone else in the discussion is a citizen (green).
// ---------------------------------------------------------------------------
AppRole deriveRole({
  required String userId,
  required String problemAuthorId,
  required Iterable<Project> projects,
}) {
  if (userId == problemAuthorId) return AppRole.owner;
  if (projects.any((p) => p.leadId == userId)) return AppRole.startup;
  return AppRole.citizen;
}
