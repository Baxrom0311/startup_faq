import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../models/models.dart';

/// Lifecycle of a single problem submission.
enum SubmitPhase { idle, submitting, success, duplicate, error }

/// Immutable state for the submit flow's network phase.
class SubmitState {
  const SubmitState({
    this.phase = SubmitPhase.idle,
    this.error,
    this.result,
    this.progressLabel,
  });

  final SubmitPhase phase;
  final String? error;

  /// The created problem (on success) or the detected duplicate (on duplicate).
  final Problem? result;

  /// Human-friendly label describing the current upload step (Uzbek).
  final String? progressLabel;

  bool get isSubmitting => phase == SubmitPhase.submitting;

  SubmitState copyWith({
    SubmitPhase? phase,
    String? error,
    Problem? result,
    String? progressLabel,
  }) =>
      SubmitState(
        phase: phase ?? this.phase,
        error: error,
        result: result ?? this.result,
        progressLabel: progressLabel,
      );
}

/// Draft the user assembled across the stepped UI.
class SubmitDraft {
  const SubmitDraft({
    this.text,
    this.audioPath,
    this.photoPaths = const [],
    this.sectorId,
    this.regionId,
  });

  final String? text;
  final String? audioPath;
  final List<String> photoPaths;
  final int? sectorId;
  final int? regionId;
}

/// Handles media upload (presign + PUT) then `POST /problems/`.
class SubmitController extends StateNotifier<SubmitState> {
  SubmitController(this._api) : super(const SubmitState());

  final ApiClient _api;

  Future<void> submit(SubmitDraft draft) async {
    state = const SubmitState(
      phase: SubmitPhase.submitting,
      progressLabel: 'Tayyorlanmoqda…',
    );

    try {
      // 1) Upload audio, if any.
      String? audioKey;
      final audioPath = draft.audioPath;
      if (audioPath != null && audioPath.isNotEmpty) {
        state = state.copyWith(progressLabel: 'Ovoz yuklanmoqda…');
        audioKey = await _api.uploadFile(
          kind: 'audio',
          contentType: _audioContentType(audioPath),
          file: File(audioPath),
        );
      }

      // 2) Upload photos, if any.
      final photoKeys = <String>[];
      for (var i = 0; i < draft.photoPaths.length; i++) {
        state = state.copyWith(
          progressLabel: 'Rasm yuklanmoqda (${i + 1}/${draft.photoPaths.length})…',
        );
        final key = await _api.uploadFile(
          kind: 'photo',
          contentType: _photoContentType(draft.photoPaths[i]),
          file: File(draft.photoPaths[i]),
        );
        photoKeys.add(key);
      }

      // 3) Create the problem.
      state = state.copyWith(progressLabel: 'Yuborilmoqda…');
      final text = draft.text?.trim();
      final json = await _api.postJson('/problems/', body: {
        if (text != null && text.isNotEmpty) 'raw_text': text,
        if (audioKey != null) 'raw_audio_key': audioKey,
        'photo_keys': photoKeys,
        if (draft.sectorId != null) 'sector_id': draft.sectorId,
        if (draft.regionId != null) 'region_id': draft.regionId,
      });

      final problem = Problem.fromJson(json);
      if (problem.isDuplicate || problem.duplicateOf != null) {
        state = SubmitState(phase: SubmitPhase.duplicate, result: problem);
      } else {
        state = SubmitState(phase: SubmitPhase.success, result: problem);
      }
    } on ApiException catch (e) {
      state = SubmitState(phase: SubmitPhase.error, error: e.message);
    } catch (_) {
      state = const SubmitState(
        phase: SubmitPhase.error,
        error: 'Kutilmagan xatolik yuz berdi. Qayta urinib ko‘ring.',
      );
    }
  }

  void reset() => state = const SubmitState();

  String _audioContentType(String path) {
    final p = path.toLowerCase();
    if (p.endsWith('.aac')) return 'audio/aac';
    if (p.endsWith('.wav')) return 'audio/wav';
    if (p.endsWith('.opus') || p.endsWith('.ogg')) return 'audio/ogg';
    // record's aacLc encoder writes an .m4a container.
    return 'audio/mp4';
  }

  String _photoContentType(String path) {
    final p = path.toLowerCase();
    if (p.endsWith('.png')) return 'image/png';
    if (p.endsWith('.webp')) return 'image/webp';
    if (p.endsWith('.heic') || p.endsWith('.heif')) return 'image/heic';
    return 'image/jpeg';
  }
}

/// Submit controller — auto-disposed so each visit to the screen is fresh.
final submitControllerProvider =
    StateNotifierProvider.autoDispose<SubmitController, SubmitState>(
  (ref) => SubmitController(ref.watch(apiClientProvider)),
);

// ---- Reference data (sectors / regions) --------------------------------
//
// These endpoints return a bare JSON array (not the {data,count} envelope),
// which `ApiClient.getJson` cannot parse, so we read the raw response and
// tolerate either shape. Named with a `submit` prefix to avoid colliding with
// any canonical `sectorsProvider` / `regionsProvider` the feed phase may add.

List<Map<String, dynamic>> _listFrom(dynamic data) {
  final raw = data is List ? data : (data is Map ? data['data'] : null);
  if (raw is List) {
    return raw
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }
  return const [];
}

final submitSectorsProvider =
    FutureProvider.autoDispose<List<Sector>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final res = await api.raw.get<dynamic>('/sectors/');
  return _listFrom(res.data).map(Sector.fromJson).toList();
});

final submitRegionsProvider =
    FutureProvider.autoDispose<List<Region>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final res = await api.raw.get<dynamic>('/regions/');
  final regions = _listFrom(res.data).map(Region.fromJson).toList()
    ..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
  return regions;
});
