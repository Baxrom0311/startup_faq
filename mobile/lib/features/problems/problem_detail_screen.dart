import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../core/config.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../shared/widgets/widgets.dart';
import 'problem_providers.dart';
import 'widgets/audio_player_bar.dart';
import 'widgets/chat_message.dart';
import 'widgets/composer.dart';
import 'widgets/solution_card.dart';

/// The live "solution chat" for a single problem — the heart of the app.
///
/// Top: the problem card (photos, audio, status/sector/region chips, title,
/// text, author + role badge, vote button). Below: a live discussion where
/// comments render as chat bubbles and startups' solution proposals render as
/// highlighted gold [SolutionCard]s. Auto-refreshes every few seconds.
class ProblemDetailScreen extends ConsumerStatefulWidget {
  const ProblemDetailScreen({super.key, required this.problemId});

  final String problemId;

  @override
  ConsumerState<ProblemDetailScreen> createState() =>
      _ProblemDetailScreenState();
}

class _ProblemDetailScreenState extends ConsumerState<ProblemDetailScreen> {
  final _scrollController = ScrollController();
  Timer? _pollTimer;
  final Set<String> _joining = {};
  bool _voteBusy = false;

  String get _id => widget.problemId;

  @override
  void initState() {
    super.initState();
    _pollTimer = Timer.periodic(AppConfig.chatRefreshInterval, (_) => _poll());
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _scrollController.dispose();
    super.dispose();
  }

  void _poll() {
    if (!mounted) return;
    ref.read(commentsProvider(_id).notifier).refreshQuietly();
    ref.read(projectsProvider(_id).notifier).refreshQuietly();
    ref.read(problemDetailProvider(_id).notifier).refreshQuietly();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 260),
        curve: Curves.easeOut,
      );
    });
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  // ---- actions ----------------------------------------------------------

  Future<void> _toggleVote() async {
    if (_voteBusy) return;
    setState(() => _voteBusy = true);
    try {
      await ref.read(problemDetailProvider(_id).notifier).toggleVote();
    } on ApiException catch (e) {
      _snack(e.message);
    } catch (_) {
      _snack('Ovoz berishda xatolik');
    } finally {
      if (mounted) setState(() => _voteBusy = false);
    }
  }

  Future<void> _sendMessage(String text) async {
    try {
      await ref.read(commentsProvider(_id).notifier).send(text: text);
      _scrollToBottom();
    } on ApiException catch (e) {
      _snack(e.message);
    } catch (_) {
      _snack('Xabar yuborilmadi');
    }
  }

  Future<void> _joinProject(Project project) async {
    if (_joining.contains(project.id)) return;
    setState(() => _joining.add(project.id));
    try {
      await ref.read(commentsProvider(_id).notifier).send(
            text: '🤝 Men "${project.title}" yechimiga qo‘shilishni xohlayman.',
          );
      _snack('Qo‘shilish istagingiz yuborildi');
      _scrollToBottom();
    } on ApiException catch (e) {
      _snack(e.message);
    } catch (_) {
      _snack('Xatolik yuz berdi');
    } finally {
      if (mounted) setState(() => _joining.remove(project.id));
    }
  }

  Future<void> _openProposeSheet() async {
    final titleCtrl = TextEditingController();
    final pitchCtrl = TextEditingController();
    final c = AppColors.of(context);

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: c.surface,
      shape: const RoundedRectangleBorder(
        borderRadius:
            BorderRadius.vertical(top: Radius.circular(AppTheme.radiusLg)),
      ),
      builder: (sheetContext) {
        var submitting = false;
        return StatefulBuilder(
          builder: (sheetContext, setSheetState) {
            Future<void> submit() async {
              final title = titleCtrl.text.trim();
              if (title.isEmpty) {
                _snack('Yechim nomini kiriting');
                return;
              }
              setSheetState(() => submitting = true);
              try {
                await ref.read(projectsProvider(_id).notifier).claim(
                      title: title,
                      pitch: pitchCtrl.text,
                    );
                if (sheetContext.mounted) Navigator.of(sheetContext).pop();
                _snack('Yechim taklifingiz yuborildi');
                _scrollToBottom();
              } on ApiException catch (e) {
                setSheetState(() => submitting = false);
                _snack(e.message);
              } catch (_) {
                setSheetState(() => submitting = false);
                _snack('Yuborishda xatolik');
              }
            }

            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 18,
                bottom: MediaQuery.of(sheetContext).viewInsets.bottom + 20,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: c.line,
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Icon(Icons.lightbulb_rounded, color: c.gold),
                      const SizedBox(width: 8),
                      Text(
                        'Yechim taklifi',
                        style: TextStyle(
                          color: c.ink,
                          fontWeight: FontWeight.w800,
                          fontSize: 18,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Ushbu muammoni hal qilish uchun o‘z yechimingizni taklif qiling.',
                    style: TextStyle(color: c.muted, height: 1.4),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: titleCtrl,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: const InputDecoration(
                      labelText: 'Yechim nomi',
                      hintText: 'Masalan: Mahalla uchun mobil ilova',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: pitchCtrl,
                    minLines: 3,
                    maxLines: 6,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: const InputDecoration(
                      labelText: 'Qisqacha tavsif (ixtiyoriy)',
                      hintText: 'Yechimingiz qanday ishlaydi?',
                      alignLabelWithHint: true,
                    ),
                  ),
                  const SizedBox(height: 18),
                  AppButton(
                    label: 'Taklifni yuborish',
                    variant: AppButtonVariant.gold,
                    icon: Icons.send_rounded,
                    loading: submitting,
                    onPressed: submit,
                  ),
                  const SizedBox(height: 4),
                ],
              ),
            );
          },
        );
      },
    );

    titleCtrl.dispose();
    pitchCtrl.dispose();
  }

  // ---- build ------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final problemAsync = ref.watch(problemDetailProvider(_id));

    return Scaffold(
      appBar: AppBar(title: const Text('Muammo')),
      body: problemAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => _ErrorView(
          message: err is ApiException ? err.message : 'Muammoni yuklab bo‘lmadi',
          onRetry: () => ref.invalidate(problemDetailProvider(_id)),
        ),
        data: (problem) => _buildLoaded(problem),
      ),
    );
  }

  Widget _buildLoaded(Problem problem) {
    final comments = ref.watch(commentsProvider(_id));
    final projects = ref.watch(projectsProvider(_id));
    final currentUserId = ref.watch(currentUserIdProvider);
    final projectList = projects.valueOrNull ?? const <Project>[];

    // Merge comments + solution proposals into one time-ordered timeline.
    final timeline = <_TimelineEntry>[
      for (final cm in comments.valueOrNull ?? const <Comment>[])
        _TimelineEntry.comment(cm),
      for (final pr in projectList) _TimelineEntry.project(pr),
    ]..sort((a, b) => a.createdAt.compareTo(b.createdAt));

    return Column(
      children: [
        Expanded(
          child: ListView(
            controller: _scrollController,
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 20),
            children: [
              _ProblemHeader(
                problem: problem,
                voteBusy: _voteBusy,
                onVote: _toggleVote,
              ),
              const SizedBox(height: 18),
              _DiscussionHeader(count: comments.valueOrNull?.length ?? 0),
              const SizedBox(height: 4),
              if (comments.isLoading && (comments.valueOrNull == null))
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 28),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (timeline.isEmpty)
                const _EmptyDiscussion()
              else
                ...timeline.map((entry) {
                  if (entry.project != null) {
                    final p = entry.project!;
                    return SolutionCard(
                      project: p,
                      joining: _joining.contains(p.id),
                      onJoin: () => _joinProject(p),
                    );
                  }
                  final cm = entry.comment!;
                  final role = deriveRole(
                    userId: cm.userId,
                    problemAuthorId: problem.authorId,
                    projects: projectList,
                  );
                  return ChatMessage(
                    comment: cm,
                    role: role,
                    isMine:
                        currentUserId != null && cm.userId == currentUserId,
                  );
                }),
            ],
          ),
        ),
        Composer(
          onSend: _sendMessage,
          onProposeSolution: _openProposeSheet,
          onVoiceTap: () =>
              _snack('Ovozli xabarlar muammo yuborishda qo‘llab-quvvatlanadi'),
          onPhotoTap: () =>
              _snack('Rasm biriktirish muammo yuborishda qo‘llab-quvvatlanadi'),
        ),
      ],
    );
  }
}

/// One item in the merged discussion timeline: either a chat comment or a
/// startup's solution proposal.
class _TimelineEntry {
  _TimelineEntry.comment(Comment c)
      : comment = c,
        project = null,
        createdAt = c.createdAt;

  _TimelineEntry.project(Project p)
      : comment = null,
        project = p,
        createdAt = p.createdAt;

  final Comment? comment;
  final Project? project;
  final String createdAt;
}

// ---------------------------------------------------------------------------
// Problem header card.
// ---------------------------------------------------------------------------
class _ProblemHeader extends ConsumerWidget {
  const _ProblemHeader({
    required this.problem,
    required this.voteBusy,
    required this.onVote,
  });

  final Problem problem;
  final bool voteBusy;
  final VoidCallback onVote;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = AppColors.of(context);
    final mediaAsync = ref.watch(problemMediaProvider(problem.id));
    final sectors = ref.watch(sectorsProvider).valueOrNull ?? const <Sector>[];
    final regions = ref.watch(regionsProvider).valueOrNull ?? const <Region>[];

    final media = mediaAsync.valueOrNull ?? const <ProblemMedia>[];
    final photos = media.where((m) => m.isPhoto).toList();
    final audio = media.where((m) => m.isAudio).toList();

    String? sectorName;
    if (problem.sectorId != null) {
      for (final s in sectors) {
        if (s.id == problem.sectorId) {
          sectorName = s.nameUz;
          break;
        }
      }
    }
    String? regionName;
    if (problem.regionId != null) {
      for (final r in regions) {
        if (r.id == problem.regionId) {
          regionName = r.name;
          break;
        }
      }
    }

    final authorName = (problem.authorName?.trim().isNotEmpty ?? false)
        ? problem.authorName!.trim()
        : 'Muallif';

    return Container(
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        border: Border.all(color: c.line),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // status / sector / region chips
          Wrap(
            spacing: 8,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              StatusChip(status: problem.status),
              if (sectorName != null) _MetaChip(icon: Icons.category_rounded, label: sectorName),
              if (regionName != null)
                _MetaChip(icon: Icons.place_rounded, label: regionName),
            ],
          ),
          const SizedBox(height: 12),
          if ((problem.title?.trim().isNotEmpty ?? false)) ...[
            Text(
              problem.title!.trim(),
              style: TextStyle(
                color: c.ink,
                fontWeight: FontWeight.w800,
                fontSize: 20,
                height: 1.25,
              ),
            ),
            const SizedBox(height: 10),
          ],
          if ((problem.rawText?.trim().isNotEmpty ?? false))
            Text(
              problem.rawText!.trim(),
              style: TextStyle(color: c.ink, height: 1.45, fontSize: 15),
            ),
          if (photos.isNotEmpty) ...[
            const SizedBox(height: 14),
            _PhotoGallery(photos: photos),
          ],
          if (audio.isNotEmpty) ...[
            const SizedBox(height: 14),
            AudioPlayerBar(url: audio.first.url),
          ],
          const SizedBox(height: 16),
          Divider(color: c.line, height: 1),
          const SizedBox(height: 12),
          Row(
            children: [
              UserAvatar(name: authorName, role: AppRole.owner, radius: 18),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            authorName,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: c.ink,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        const RoleBadge(role: AppRole.owner, dense: true),
                      ],
                    ),
                    Text(
                      formatTimeAgo(problem.createdAt),
                      style: TextStyle(color: c.muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
              _VoteButton(
                voted: problem.hasVoted,
                count: problem.voteCount,
                busy: voteBusy,
                onTap: onVote,
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              _Stat(
                icon: Icons.forum_rounded,
                value: problem.commentCount,
                color: c.brand,
              ),
              const SizedBox(width: 18),
              _Stat(
                icon: Icons.lightbulb_rounded,
                value: problem.projectCount,
                color: c.gold,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _VoteButton extends StatelessWidget {
  const _VoteButton({
    required this.voted,
    required this.count,
    required this.busy,
    required this.onTap,
  });

  final bool voted;
  final int count;
  final bool busy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final color = voted ? c.green : c.muted;

    return InkWell(
      onTap: busy ? null : onTap,
      borderRadius: BorderRadius.circular(AppTheme.radius),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: voted ? c.green.withValues(alpha: 0.12) : c.bg,
          borderRadius: BorderRadius.circular(AppTheme.radius),
          border: Border.all(
            color: voted ? c.green.withValues(alpha: 0.40) : c.line,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            busy
                ? SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.2,
                      valueColor: AlwaysStoppedAnimation(color),
                    ),
                  )
                : Icon(
                    voted
                        ? Icons.arrow_upward_rounded
                        : Icons.arrow_upward_outlined,
                    color: color,
                    size: 20,
                  ),
            const SizedBox(width: 6),
            Text(
              '$count',
              style: TextStyle(
                color: color,
                fontWeight: FontWeight.w800,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.icon, required this.value, required this.color});

  final IconData icon;
  final int value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 18, color: color),
        const SizedBox(width: 6),
        Text(
          '$value',
          style: TextStyle(
            color: c.muted,
            fontWeight: FontWeight.w700,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
      ],
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: c.bg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: c.line),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: c.muted),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              color: c.muted,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _PhotoGallery extends StatelessWidget {
  const _PhotoGallery({required this.photos});

  final List<ProblemMedia> photos;

  @override
  Widget build(BuildContext context) {
    if (photos.length == 1) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(AppTheme.radius),
        child: _Photo(url: photos.first.url, height: 200),
      );
    }
    return SizedBox(
      height: 150,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: photos.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, i) => ClipRRect(
          borderRadius: BorderRadius.circular(AppTheme.radius),
          child: _Photo(url: photos[i].url, width: 200, height: 150),
        ),
      ),
    );
  }
}

class _Photo extends StatelessWidget {
  const _Photo({required this.url, this.width, required this.height});

  final String url;
  final double? width;
  final double height;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    // Uses the project's cached_network_image via UserAvatar elsewhere; here a
    // plain cached image keeps the header lightweight.
    return Container(
      width: width ?? double.infinity,
      height: height,
      color: c.bg,
      child: Image.network(
        url,
        fit: BoxFit.cover,
        width: width ?? double.infinity,
        height: height,
        loadingBuilder: (context, child, progress) {
          if (progress == null) return child;
          return const Center(child: CircularProgressIndicator());
        },
        errorBuilder: (context, _, __) => Center(
          child: Icon(Icons.broken_image_rounded, color: c.muted),
        ),
      ),
    );
  }
}

class _DiscussionHeader extends StatelessWidget {
  const _DiscussionHeader({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Row(
      children: [
        Icon(Icons.forum_rounded, size: 18, color: c.brand),
        const SizedBox(width: 8),
        Text(
          'Muhokama',
          style: TextStyle(
            color: c.ink,
            fontWeight: FontWeight.w800,
            fontSize: 16,
          ),
        ),
        const SizedBox(width: 8),
        if (count > 0)
          Text(
            '$count',
            style: TextStyle(
              color: c.muted,
              fontWeight: FontWeight.w700,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
      ],
    );
  }
}

class _EmptyDiscussion extends StatelessWidget {
  const _EmptyDiscussion();

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 28),
      child: Column(
        children: [
          Icon(Icons.chat_bubble_outline_rounded, size: 40, color: c.muted),
          const SizedBox(height: 10),
          Text(
            'Hali muhokama boshlanmagan.\nBirinchi bo‘lib fikr bildiring!',
            textAlign: TextAlign.center,
            style: TextStyle(color: c.muted, height: 1.4),
          ),
        ],
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
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline_rounded, size: 44, color: c.muted),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(color: c.ink, height: 1.4),
            ),
            const SizedBox(height: 16),
            AppButton(
              label: 'Qayta urinish',
              variant: AppButtonVariant.outline,
              icon: Icons.refresh_rounded,
              expand: false,
              onPressed: onRetry,
            ),
          ],
        ),
      ),
    );
  }
}
