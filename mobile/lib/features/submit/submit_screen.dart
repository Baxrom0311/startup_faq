import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/router.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../shared/widgets/widgets.dart';
import 'submit_controller.dart';
import 'widgets/option_picker.dart';
import 'widgets/photo_picker_strip.dart';
import 'widgets/record_panel.dart';
import 'widgets/submit_result.dart';

/// Voice-first, three-step problem submission.
///
///  1. Tell the problem — record voice, type, and/or add photos.
///  2. (Optional) location & sector — AI auto-tags if left blank.
///  3. Review & send.
class SubmitScreen extends ConsumerStatefulWidget {
  const SubmitScreen({super.key});

  @override
  ConsumerState<SubmitScreen> createState() => _SubmitScreenState();
}

class _SubmitScreenState extends ConsumerState<SubmitScreen> {
  static const int _stepCount = 3;

  final PageController _pageController = PageController();
  final TextEditingController _textController = TextEditingController();

  int _step = 0;

  String? _audioPath;
  Duration? _audioDuration;
  List<XFile> _photos = [];

  Sector? _sector;
  Region? _region;

  @override
  void dispose() {
    _pageController.dispose();
    _textController.dispose();
    super.dispose();
  }

  bool get _hasContent =>
      _textController.text.trim().isNotEmpty || _audioPath != null;

  void _goTo(int step) {
    setState(() => _step = step);
    _pageController.animateToPage(
      step,
      duration: const Duration(milliseconds: 260),
      curve: Curves.easeInOut,
    );
  }

  void _next() {
    FocusScope.of(context).unfocus();
    if (_step < _stepCount - 1) {
      _goTo(_step + 1);
    } else {
      _submit();
    }
  }

  void _back() {
    FocusScope.of(context).unfocus();
    if (_step > 0) _goTo(_step - 1);
  }

  Future<void> _submit() async {
    final draft = SubmitDraft(
      text: _textController.text,
      audioPath: _audioPath,
      photoPaths: _photos.map((x) => x.path).toList(),
      sectorId: _sector?.id,
      regionId: _region?.id,
    );
    await ref.read(submitControllerProvider.notifier).submit(draft);
  }

  Future<void> _confirmDiscard() async {
    if (!_hasContent) {
      if (mounted) context.pop();
      return;
    }
    final c = AppColors.of(context);
    final leave = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Chiqib ketilsinmi?'),
        content: const Text('Kiritilgan ma’lumotlar saqlanmaydi.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Bekor qilish'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: TextButton.styleFrom(foregroundColor: c.gold),
            child: const Text('Chiqish'),
          ),
        ],
      ),
    );
    if (leave == true && mounted) context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final state = ref.watch(submitControllerProvider);

    // React to network outcomes.
    ref.listen<SubmitState>(submitControllerProvider, (prev, next) {
      if (prev?.phase == next.phase) return;
      if (next.phase == SubmitPhase.duplicate && next.result != null) {
        showDuplicateSheet(context, duplicate: next.result!);
      } else if (next.phase == SubmitPhase.error) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(next.error ?? 'Xatolik yuz berdi')),
        );
      }
    });

    if (state.phase == SubmitPhase.success) {
      return Scaffold(
        body: SubmitSuccessView(onDone: () => context.go(Routes.home)),
      );
    }

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _confirmDiscard();
      },
      child: Scaffold(
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.close_rounded),
            onPressed: _confirmDiscard,
          ),
          title: Text(_titleForStep(_step)),
        ),
        body: Stack(
          children: [
            Column(
              children: [
                _StepIndicator(step: _step, count: _stepCount),
                Expanded(
                  child: PageView(
                    controller: _pageController,
                    physics: const NeverScrollableScrollPhysics(),
                    children: [
                      _buildStep1(c),
                      _buildStep2(c),
                      _buildStep3(c),
                    ],
                  ),
                ),
                _buildBottomBar(c, state),
              ],
            ),
            if (state.isSubmitting) _ProgressOverlay(label: state.progressLabel),
          ],
        ),
      ),
    );
  }

  String _titleForStep(int step) => switch (step) {
        0 => 'Muammoni ayting',
        1 => 'Joylashuv va soha',
        _ => 'Tekshirish',
      };

  // ---- Step 1: tell the problem -----------------------------------------

  Widget _buildStep1(AppColors c) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      children: [
        Text(
          'Muammoni ayting yoki yozing',
          style: TextStyle(color: c.ink, fontSize: 20, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 6),
        Text(
          'Ovozli xabar qoldiring — bu eng oson yo‘l. Xohlasangiz matn va rasm '
          'ham qo‘shishingiz mumkin.',
          style: TextStyle(color: c.muted, height: 1.4),
        ),
        const SizedBox(height: 24),
        RecordPanel(
          audioPath: _audioPath,
          recordedDuration: _audioDuration,
          onRecorded: (path, dur) => setState(() {
            _audioPath = path;
            _audioDuration = dur;
          }),
          onDeleted: () => setState(() {
            _audioPath = null;
            _audioDuration = null;
          }),
        ),
        const SizedBox(height: 24),
        _SectionLabel(label: 'Matn (ixtiyoriy)', color: c),
        const SizedBox(height: 8),
        TextField(
          controller: _textController,
          minLines: 3,
          maxLines: 8,
          maxLength: 2000,
          textInputAction: TextInputAction.newline,
          onChanged: (_) => setState(() {}),
          decoration: const InputDecoration(
            hintText: 'Masalan: Mahallamizda ko‘chalar yoritilmagan…',
          ),
        ),
        const SizedBox(height: 8),
        _SectionLabel(label: 'Rasmlar (ixtiyoriy)', color: c),
        const SizedBox(height: 8),
        PhotoPickerStrip(
          photos: _photos,
          onChanged: (list) => setState(() => _photos = list),
        ),
      ],
    );
  }

  // ---- Step 2: optional location & sector -------------------------------

  Widget _buildStep2(AppColors c) {
    final sectorsAsync = ref.watch(submitSectorsProvider);
    final regionsAsync = ref.watch(submitRegionsProvider);

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      children: [
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: c.green.withValues(alpha: 0.10),
            borderRadius: BorderRadius.circular(AppTheme.radius),
            border: Border.all(color: c.green.withValues(alpha: 0.30)),
          ),
          child: Row(
            children: [
              Icon(Icons.auto_awesome_rounded, color: c.green),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Bilmasangiz bo‘sh qoldiring — AI o‘zi aniqlaydi.',
                  style: TextStyle(color: c.ink, fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        OptionPickerField(
          icon: Icons.place_rounded,
          label: 'Hudud (ixtiyoriy)',
          hint: 'Hududni tanlang',
          valueLabel: _region?.name,
          onClear: () => setState(() => _region = null),
          onTap: () => _pickRegion(regionsAsync),
        ),
        const SizedBox(height: 20),
        OptionPickerField(
          icon: Icons.category_rounded,
          label: 'Soha (ixtiyoriy)',
          hint: 'Sohani tanlang',
          valueLabel: _sector?.nameUz,
          onClear: () => setState(() => _sector = null),
          onTap: () => _pickSector(sectorsAsync),
        ),
      ],
    );
  }

  Future<void> _pickRegion(AsyncValue<List<Region>> async) async {
    final regions = async.valueOrNull;
    if (regions == null || regions.isEmpty) {
      _notReady(async);
      return;
    }
    final picked = await showOptionPicker<Region>(
      context,
      title: 'Hududni tanlang',
      options: regions
          .map((r) => PickerOption(value: r, label: r.name))
          .toList(),
    );
    if (picked != null) setState(() => _region = picked);
  }

  Future<void> _pickSector(AsyncValue<List<Sector>> async) async {
    final sectors = async.valueOrNull;
    if (sectors == null || sectors.isEmpty) {
      _notReady(async);
      return;
    }
    final picked = await showOptionPicker<Sector>(
      context,
      title: 'Sohani tanlang',
      options: sectors
          .map((s) => PickerOption(value: s, label: s.nameUz))
          .toList(),
    );
    if (picked != null) setState(() => _sector = picked);
  }

  void _notReady(AsyncValue async) {
    final msg = async.isLoading
        ? 'Yuklanmoqda…'
        : 'Ro‘yxatni yuklab bo‘lmadi. Bo‘sh qoldirsangiz ham bo‘ladi.';
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(msg)));
  }

  // ---- Step 3: review ---------------------------------------------------

  Widget _buildStep3(AppColors c) {
    final text = _textController.text.trim();
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      children: [
        Text(
          'Hammasi to‘g‘rimi?',
          style: TextStyle(color: c.ink, fontSize: 20, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 6),
        Text(
          'Yuborishdan oldin bir bor ko‘zdan kechiring.',
          style: TextStyle(color: c.muted),
        ),
        const SizedBox(height: 20),
        _ReviewTile(
          icon: Icons.mic_rounded,
          title: 'Ovozli xabar',
          value: _audioPath != null
              ? _fmtDuration(_audioDuration ?? Duration.zero)
              : 'Yo‘q',
          color: c,
          onEdit: () => _goTo(0),
        ),
        _ReviewTile(
          icon: Icons.notes_rounded,
          title: 'Matn',
          value: text.isNotEmpty ? text : 'Yo‘q',
          color: c,
          onEdit: () => _goTo(0),
        ),
        _ReviewTile(
          icon: Icons.image_rounded,
          title: 'Rasmlar',
          value: _photos.isEmpty ? 'Yo‘q' : '${_photos.length} ta',
          color: c,
          onEdit: () => _goTo(0),
        ),
        _ReviewTile(
          icon: Icons.place_rounded,
          title: 'Hudud',
          value: _region?.name ?? 'AI aniqlaydi',
          color: c,
          onEdit: () => _goTo(1),
        ),
        _ReviewTile(
          icon: Icons.category_rounded,
          title: 'Soha',
          value: _sector?.nameUz ?? 'AI aniqlaydi',
          color: c,
          onEdit: () => _goTo(1),
          isLast: true,
        ),
      ],
    );
  }

  String _fmtDuration(Duration d) {
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  // ---- Bottom action bar ------------------------------------------------

  Widget _buildBottomBar(AppColors c, SubmitState state) {
    final isLast = _step == _stepCount - 1;
    final canProceed = _step != 0 || _hasContent;

    return Container(
      padding: EdgeInsets.fromLTRB(
        20,
        12,
        20,
        12 + MediaQuery.of(context).padding.bottom,
      ),
      decoration: BoxDecoration(
        color: c.surface,
        border: Border(top: BorderSide(color: c.line)),
      ),
      child: Row(
        children: [
          if (_step > 0) ...[
            Expanded(
              child: AppButton(
                label: 'Orqaga',
                variant: AppButtonVariant.outline,
                onPressed: state.isSubmitting ? null : _back,
              ),
            ),
            const SizedBox(width: 12),
          ],
          Expanded(
            flex: _step > 0 ? 1 : 1,
            child: AppButton(
              label: isLast ? 'Yuborish' : 'Davom etish',
              icon: isLast ? Icons.send_rounded : Icons.arrow_forward_rounded,
              variant: isLast ? AppButtonVariant.green : AppButtonVariant.primary,
              loading: state.isSubmitting,
              onPressed: canProceed && !state.isSubmitting ? _next : null,
            ),
          ),
        ],
      ),
    );
  }
}

// ---- Small private widgets ----------------------------------------------

class _StepIndicator extends StatelessWidget {
  const _StepIndicator({required this.step, required this.count});

  final int step;
  final int count;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
      child: Row(
        children: [
          for (var i = 0; i < count; i++) ...[
            Expanded(
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 220),
                height: 5,
                decoration: BoxDecoration(
                  color: i <= step ? c.brand : c.line,
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
            ),
            if (i < count - 1) const SizedBox(width: 6),
          ],
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.label, required this.color});

  final String label;
  final AppColors color;

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: TextStyle(
        color: color.muted,
        fontSize: 12,
        fontWeight: FontWeight.w600,
      ),
    );
  }
}

class _ReviewTile extends StatelessWidget {
  const _ReviewTile({
    required this.icon,
    required this.title,
    required this.value,
    required this.color,
    required this.onEdit,
    this.isLast = false,
  });

  final IconData icon;
  final String title;
  final String value;
  final AppColors color;
  final VoidCallback onEdit;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final c = color;
    return Container(
      margin: EdgeInsets.only(bottom: isLast ? 0 : 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(AppTheme.radius),
        border: Border.all(color: c.line),
      ),
      child: Row(
        children: [
          Icon(icon, size: 20, color: c.brand),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    color: c.muted,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: c.ink, fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ),
          TextButton(onPressed: onEdit, child: const Text('O‘zgartirish')),
        ],
      ),
    );
  }
}

class _ProgressOverlay extends StatelessWidget {
  const _ProgressOverlay({this.label});

  final String? label;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Positioned.fill(
      child: ColoredBox(
        color: Colors.black.withValues(alpha: 0.45),
        child: Center(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
            decoration: BoxDecoration(
              color: c.surface,
              borderRadius: BorderRadius.circular(AppTheme.radiusLg),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                CircularProgressIndicator(color: c.brand),
                const SizedBox(height: 16),
                Text(
                  label ?? 'Yuborilmoqda…',
                  style: TextStyle(color: c.ink, fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
