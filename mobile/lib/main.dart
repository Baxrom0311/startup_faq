import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/api_client.dart';
import 'core/router.dart';
import 'core/storage.dart';
import 'core/theme.dart';
import 'features/profile/app_settings_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Load persisted tokens before the first frame so the auth gate is correct.
  final storage = TokenStorage();
  await storage.prime();

  runApp(
    ProviderScope(
      overrides: [
        tokenStorageProvider.overrideWithValue(storage),
      ],
      child: const SolutionLabApp(),
    ),
  );
}

class SolutionLabApp extends ConsumerWidget {
  const SolutionLabApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    // Apply the user's persisted theme preference (defaults to system).
    final settings = ref.watch(appSettingsProvider);

    return MaterialApp.router(
      title: 'SolutionLab',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: settings.themeMode,
      routerConfig: router,
    );
  }
}
