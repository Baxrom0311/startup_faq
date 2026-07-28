import 'package:flutter/material.dart';

import '../../core/theme.dart';

/// Large, voice-first primary record button. Purely presentational — the
/// caller owns recording state and wires [onTap].
class VoiceRecordButton extends StatelessWidget {
  const VoiceRecordButton({
    super.key,
    required this.isRecording,
    required this.onTap,
    this.size = 84,
    this.label,
  });

  final bool isRecording;
  final VoidCallback onTap;
  final double size;

  /// Optional caption under the button (e.g. elapsed time or a hint).
  final String? label;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final color = isRecording ? c.gold : c.brand;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        GestureDetector(
          onTap: onTap,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            width: size,
            height: size,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: color,
              boxShadow: [
                BoxShadow(
                  color: color.withValues(alpha: isRecording ? 0.45 : 0.30),
                  blurRadius: isRecording ? 28 : 16,
                  spreadRadius: isRecording ? 4 : 0,
                ),
              ],
            ),
            child: Icon(
              isRecording ? Icons.stop_rounded : Icons.mic_rounded,
              color: Colors.white,
              size: size * 0.44,
            ),
          ),
        ),
        if (label != null) ...[
          const SizedBox(height: 10),
          Text(
            label!,
            style: TextStyle(
              color: c.muted,
              fontWeight: FontWeight.w600,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ],
    );
  }
}
