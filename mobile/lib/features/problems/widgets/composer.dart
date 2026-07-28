import 'package:flutter/material.dart';

import '../../../core/theme.dart';

/// Bottom composer for the live solution chat.
///
/// Contains a text field, secondary mic + camera actions, a send button, and a
/// prominent "Yechim taklif qilish" (propose a solution) button.
///
/// Voice and photo attachments belong to problem *submission* (the Submit
/// flow); on a text-only discussion message these buttons surface a hint via
/// [onVoiceTap] / [onPhotoTap] rather than attaching media.
class Composer extends StatefulWidget {
  const Composer({
    super.key,
    required this.onSend,
    required this.onProposeSolution,
    this.onVoiceTap,
    this.onPhotoTap,
  });

  /// Sends a text message. Should complete when the message is delivered so the
  /// composer can clear itself and re-enable input.
  final Future<void> Function(String text) onSend;

  /// Opens the "Yechim taklifi" proposal sheet.
  final VoidCallback onProposeSolution;

  final VoidCallback? onVoiceTap;
  final VoidCallback? onPhotoTap;

  @override
  State<Composer> createState() => _ComposerState();
}

class _ComposerState extends State<Composer> {
  final _controller = TextEditingController();
  final _focus = FocusNode();
  bool _sending = false;
  bool _hasText = false;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onChanged);
  }

  void _onChanged() {
    final has = _controller.text.trim().isNotEmpty;
    if (has != _hasText) setState(() => _hasText = has);
  }

  @override
  void dispose() {
    _controller.removeListener(_onChanged);
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      await widget.onSend(text);
      _controller.clear();
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);

    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
        decoration: BoxDecoration(
          color: c.surface,
          border: Border(top: BorderSide(color: c.line)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Prominent "propose a solution" call to action.
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: widget.onProposeSolution,
                style: FilledButton.styleFrom(
                  backgroundColor: c.gold,
                  foregroundColor: Colors.white,
                  minimumSize: const Size(0, 46),
                ),
                icon: const Icon(Icons.lightbulb_rounded, size: 20),
                label: const Text('Yechim taklif qilish'),
              ),
            ),
            const SizedBox(height: 10),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                _CircleAction(
                  icon: Icons.mic_rounded,
                  color: c.brand,
                  onTap: widget.onVoiceTap,
                ),
                const SizedBox(width: 6),
                _CircleAction(
                  icon: Icons.photo_camera_rounded,
                  color: c.brand,
                  onTap: widget.onPhotoTap,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: _controller,
                    focusNode: _focus,
                    minLines: 1,
                    maxLines: 5,
                    textInputAction: TextInputAction.newline,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: const InputDecoration(
                      hintText: 'Fikringizni yozing…',
                      contentPadding:
                          EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                _SendButton(
                  enabled: _hasText,
                  loading: _sending,
                  color: c.brand,
                  onTap: _send,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _CircleAction extends StatelessWidget {
  const _CircleAction({
    required this.icon,
    required this.color,
    this.onTap,
  });

  final IconData icon;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: onTap,
      visualDensity: VisualDensity.compact,
      icon: Icon(icon, color: color),
      tooltip: null,
    );
  }
}

class _SendButton extends StatelessWidget {
  const _SendButton({
    required this.enabled,
    required this.loading,
    required this.color,
    required this.onTap,
  });

  final bool enabled;
  final bool loading;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: enabled && !loading ? onTap : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        width: 48,
        height: 48,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: enabled ? color : color.withValues(alpha: 0.35),
        ),
        child: loading
            ? const Padding(
                padding: EdgeInsets.all(13),
                child: CircularProgressIndicator(
                  strokeWidth: 2.4,
                  valueColor: AlwaysStoppedAnimation(Colors.white),
                ),
              )
            : const Icon(Icons.send_rounded, color: Colors.white, size: 22),
      ),
    );
  }
}
