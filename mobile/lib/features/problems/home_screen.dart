import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'problems_feed_screen.dart';

/// Home tab (shell branch 0) — the problems feed.
///
/// Kept as a thin wrapper so the router's `const HomeScreen()` contract is
/// unchanged; all feed logic lives in [ProblemsFeedScreen].
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return const ProblemsFeedScreen();
  }
}
