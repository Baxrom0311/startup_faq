import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';

import '../../../core/theme.dart';

/// Compact inline audio player for a problem's voice recording.
class AudioPlayerBar extends StatefulWidget {
  const AudioPlayerBar({super.key, required this.url});

  final String url;

  @override
  State<AudioPlayerBar> createState() => _AudioPlayerBarState();
}

class _AudioPlayerBarState extends State<AudioPlayerBar> {
  final _player = AudioPlayer();
  bool _loading = true;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    try {
      await _player.setUrl(widget.url);
      if (mounted) setState(() => _loading = false);
    } catch (_) {
      if (mounted) {
        setState(() {
          _loading = false;
          _failed = true;
        });
      }
    }
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }

  String _fmt(Duration d) {
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: c.brand.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppTheme.radius),
        border: Border.all(color: c.brand.withValues(alpha: 0.20)),
      ),
      child: _failed
          ? Row(
              children: [
                Icon(Icons.error_outline_rounded, color: c.muted, size: 20),
                const SizedBox(width: 10),
                Text('Audioni yuklab bo‘lmadi',
                    style: TextStyle(color: c.muted)),
              ],
            )
          : StreamBuilder<PlayerState>(
              stream: _player.playerStateStream,
              builder: (context, snapshot) {
                final playing = snapshot.data?.playing ?? false;
                final processing = snapshot.data?.processingState;
                final ended = processing == ProcessingState.completed;

                return Row(
                  children: [
                    IconButton(
                      onPressed: _loading
                          ? null
                          : () async {
                              if (ended) {
                                await _player.seek(Duration.zero);
                                await _player.play();
                              } else if (playing) {
                                await _player.pause();
                              } else {
                                await _player.play();
                              }
                            },
                      icon: _loading
                          ? SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.2,
                                valueColor: AlwaysStoppedAnimation(c.brand),
                              ),
                            )
                          : Icon(
                              (playing && !ended)
                                  ? Icons.pause_circle_filled_rounded
                                  : Icons.play_circle_fill_rounded,
                              color: c.brand,
                              size: 34,
                            ),
                    ),
                    Icon(Icons.graphic_eq_rounded, color: c.brand, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: StreamBuilder<Duration>(
                        stream: _player.positionStream,
                        builder: (context, posSnap) {
                          final pos = posSnap.data ?? Duration.zero;
                          final total = _player.duration ?? Duration.zero;
                          final max = total.inMilliseconds.toDouble();
                          final value = max <= 0
                              ? 0.0
                              : pos.inMilliseconds
                                  .clamp(0, total.inMilliseconds)
                                  .toDouble();
                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              SliderTheme(
                                data: SliderTheme.of(context).copyWith(
                                  trackHeight: 3,
                                  activeTrackColor: c.brand,
                                  inactiveTrackColor:
                                      c.brand.withValues(alpha: 0.20),
                                  thumbColor: c.brand,
                                  thumbShape: const RoundSliderThumbShape(
                                    enabledThumbRadius: 6,
                                  ),
                                  overlayShape: const RoundSliderOverlayShape(
                                    overlayRadius: 12,
                                  ),
                                ),
                                child: Slider(
                                  min: 0,
                                  max: max <= 0 ? 1 : max,
                                  value: value,
                                  onChanged: max <= 0
                                      ? null
                                      : (v) => _player
                                          .seek(Duration(milliseconds: v.toInt())),
                                ),
                              ),
                              Padding(
                                padding:
                                    const EdgeInsets.symmetric(horizontal: 4),
                                child: Text(
                                  '${_fmt(pos)} / ${_fmt(total)}',
                                  style: TextStyle(
                                    color: c.muted,
                                    fontSize: 11,
                                    fontFeatures: const [
                                      FontFeature.tabularFigures()
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          );
                        },
                      ),
                    ),
                  ],
                );
              },
            ),
    );
  }
}
