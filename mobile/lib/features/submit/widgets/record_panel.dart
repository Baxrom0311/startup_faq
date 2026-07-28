import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import 'package:record/record.dart';

import '../../../core/theme.dart';
import '../../../shared/widgets/widgets.dart';

/// Maximum recording length.
const Duration _maxRecordDuration = Duration(seconds: 120);

/// Big voice-first recording panel. Owns its [AudioRecorder]; reports the
/// finished clip back to the parent via [onRecorded] and clearing via
/// [onDeleted]. When [audioPath] is non-null it shows a playback preview.
class RecordPanel extends StatefulWidget {
  const RecordPanel({
    super.key,
    required this.audioPath,
    required this.recordedDuration,
    required this.onRecorded,
    required this.onDeleted,
  });

  final String? audioPath;
  final Duration? recordedDuration;
  final void Function(String path, Duration duration) onRecorded;
  final VoidCallback onDeleted;

  @override
  State<RecordPanel> createState() => _RecordPanelState();
}

class _RecordPanelState extends State<RecordPanel> {
  final AudioRecorder _recorder = AudioRecorder();
  AudioPlayer? _player;

  bool _isRecording = false;
  Duration _elapsed = Duration.zero;
  Timer? _ticker;
  StreamSubscription<Amplitude>? _ampSub;
  final List<double> _levels = <double>[];

  bool _isPlaying = false;
  StreamSubscription<PlayerState>? _playerSub;

  @override
  void dispose() {
    _ticker?.cancel();
    _ampSub?.cancel();
    _playerSub?.cancel();
    _recorder.dispose();
    _player?.dispose();
    super.dispose();
  }

  Future<void> _toggleRecord() async {
    if (_isRecording) {
      await _stop();
    } else {
      await _start();
    }
  }

  Future<void> _start() async {
    final hasPermission = await _recorder.hasPermission();
    if (!hasPermission) {
      if (mounted) {
        _snack('Ovoz yozish uchun mikrofon ruxsati kerak.');
      }
      return;
    }

    // Discard any previous clip when starting a fresh recording.
    if (widget.audioPath != null) {
      widget.onDeleted();
    }
    await _disposePlayer();

    final path =
        '${Directory.systemTemp.path}/solutionlab_${DateTime.now().millisecondsSinceEpoch}.m4a';

    await _recorder.start(
      const RecordConfig(encoder: AudioEncoder.aacLc, bitRate: 96000),
      path: path,
    );

    _levels.clear();
    _ampSub = _recorder
        .onAmplitudeChanged(const Duration(milliseconds: 160))
        .listen(_onAmplitude);

    setState(() {
      _isRecording = true;
      _elapsed = Duration.zero;
    });

    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      final next = _elapsed + const Duration(seconds: 1);
      setState(() => _elapsed = next);
      if (next >= _maxRecordDuration) {
        _stop();
      }
    });
  }

  void _onAmplitude(Amplitude amp) {
    // `current` is dBFS in roughly [-45, 0]. Normalise to [0.06, 1].
    const minDb = -45.0;
    final db = amp.current.clamp(minDb, 0.0);
    final norm = ((db - minDb) / -minDb).clamp(0.0, 1.0);
    setState(() {
      _levels.add(0.06 + norm * 0.94);
      if (_levels.length > 48) _levels.removeAt(0);
    });
  }

  Future<void> _stop() async {
    _ticker?.cancel();
    await _ampSub?.cancel();
    _ampSub = null;
    final path = await _recorder.stop();
    final duration = _elapsed;
    setState(() => _isRecording = false);
    if (path != null && duration.inMilliseconds > 400) {
      widget.onRecorded(path, duration);
    } else if (path != null) {
      // Too short — treat as no recording.
      _tryDelete(path);
      _snack('Juda qisqa. Biroz uzoqroq gapiring.');
    }
  }

  Future<void> _togglePlay() async {
    final path = widget.audioPath;
    if (path == null) return;

    final player = _player ??= AudioPlayer();
    if (_isPlaying) {
      await player.pause();
      return;
    }

    _playerSub ??= player.playerStateStream.listen((s) {
      final playing = s.playing && s.processingState != ProcessingState.completed;
      if (mounted) setState(() => _isPlaying = playing);
      if (s.processingState == ProcessingState.completed) {
        player.seek(Duration.zero);
        player.pause();
      }
    });

    try {
      if (player.audioSource == null) {
        await player.setFilePath(path);
      } else {
        await player.seek(Duration.zero);
      }
      await player.play();
    } catch (_) {
      _snack('Ovozni ijro etib bo‘lmadi.');
    }
  }

  Future<void> _deleteClip() async {
    await _disposePlayer();
    final path = widget.audioPath;
    if (path != null) _tryDelete(path);
    widget.onDeleted();
  }

  Future<void> _disposePlayer() async {
    await _playerSub?.cancel();
    _playerSub = null;
    await _player?.dispose();
    _player = null;
    if (mounted) setState(() => _isPlaying = false);
  }

  void _tryDelete(String path) {
    try {
      final f = File(path);
      if (f.existsSync()) f.deleteSync();
    } catch (_) {/* best effort */}
  }

  void _snack(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final hasClip = widget.audioPath != null && !_isRecording;

    if (hasClip) {
      return _PreviewCard(
        duration: widget.recordedDuration ?? Duration.zero,
        isPlaying: _isPlaying,
        onPlayPause: _togglePlay,
        onDelete: _deleteClip,
        onReRecord: _start,
      );
    }

    return Column(
      children: [
        SizedBox(
          height: 44,
          child: _Waveform(levels: _levels, active: _isRecording, color: c.gold),
        ),
        const SizedBox(height: 16),
        VoiceRecordButton(
          isRecording: _isRecording,
          onTap: _toggleRecord,
          size: 96,
          label: _isRecording
              ? '${_fmt(_elapsed)} / ${_fmt(_maxRecordDuration)}'
              : 'Bosing va gapiring',
        ),
        const SizedBox(height: 8),
        Text(
          _isRecording ? 'To‘xtatish uchun yana bosing' : 'Eng ko‘pi 2 daqiqa',
          style: TextStyle(color: c.muted, fontSize: 12),
        ),
      ],
    );
  }

  static String _fmt(Duration d) {
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$m:$s';
  }
}

class _PreviewCard extends StatelessWidget {
  const _PreviewCard({
    required this.duration,
    required this.isPlaying,
    required this.onPlayPause,
    required this.onDelete,
    required this.onReRecord,
  });

  final Duration duration;
  final bool isPlaying;
  final VoidCallback onPlayPause;
  final VoidCallback onDelete;
  final VoidCallback onReRecord;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: c.gold.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(AppTheme.radius),
        border: Border.all(color: c.gold.withValues(alpha: 0.35)),
      ),
      child: Row(
        children: [
          GestureDetector(
            onTap: onPlayPause,
            child: Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(color: c.gold, shape: BoxShape.circle),
              child: Icon(
                isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                color: Colors.white,
                size: 30,
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Ovozli xabar',
                  style: TextStyle(color: c.ink, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                Text(
                  _RecordPanelState._fmt(duration),
                  style: TextStyle(
                    color: c.muted,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Qayta yozish',
            onPressed: onReRecord,
            icon: Icon(Icons.mic_rounded, color: c.brand),
          ),
          IconButton(
            tooltip: 'O‘chirish',
            onPressed: onDelete,
            icon: Icon(Icons.delete_outline_rounded, color: c.muted),
          ),
        ],
      ),
    );
  }
}

/// Lightweight amplitude "waveform" — a row of live level bars.
class _Waveform extends StatelessWidget {
  const _Waveform({
    required this.levels,
    required this.active,
    required this.color,
  });

  final List<double> levels;
  final bool active;
  final Color color;

  @override
  Widget build(BuildContext context) {
    if (!active && levels.isEmpty) return const SizedBox.shrink();
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        for (final level in levels)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 1.5),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 120),
              width: 3.5,
              height: 6 + level * 34,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.85),
                borderRadius: BorderRadius.circular(3),
              ),
            ),
          ),
      ],
    );
  }
}
