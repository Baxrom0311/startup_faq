import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/auth_controller.dart';
import '../features/auth/connect_telegram_screen.dart';
import '../features/auth/login_screen.dart';
import '../features/auth/splash_screen.dart';
import '../features/notifications/notifications_screen.dart';
import '../features/problems/home_screen.dart';
import '../features/problems/problem_detail_screen.dart';
import '../features/profile/profile_screen.dart';
import '../features/shell/home_shell.dart';
import '../features/submit/submit_screen.dart';

/// Route path constants — use these instead of raw strings.
abstract class Routes {
  static const splash = '/splash';
  static const login = '/login';
  static const connectTelegram = '/connect-telegram';
  static const home = '/home';
  static const notifications = '/notifications';
  static const profile = '/profile';
  static const submit = '/submit';

  /// `/problem/:id` — use [problem] to build a concrete path.
  static String problem(String id) => '/problem/$id';
}

final _rootKey = GlobalKey<NavigatorState>(debugLabel: 'root');
final _shellKey = GlobalKey<NavigatorState>(debugLabel: 'shell');

/// Bridges a Riverpod change into a [Listenable] for go_router's
/// `refreshListenable`, so redirects re-run when auth state changes.
class _AuthRefresh extends ChangeNotifier {
  _AuthRefresh(Ref ref) {
    ref.listen<AuthState>(
      authControllerProvider,
      (_, __) => notifyListeners(),
    );
  }
}

final routerProvider = Provider<GoRouter>((ref) {
  final refresh = _AuthRefresh(ref);

  return GoRouter(
    navigatorKey: _rootKey,
    initialLocation: Routes.splash,
    debugLogDiagnostics: kDebugMode,
    refreshListenable: refresh,
    redirect: (context, state) {
      final status = ref.read(authControllerProvider).status;
      final loc = state.matchedLocation;

      final onSplash = loc == Routes.splash;
      final onLogin = loc == Routes.login;
      final onConnect = loc == Routes.connectTelegram;

      switch (status) {
        case AuthStatus.unknown:
          return onSplash ? null : Routes.splash;

        case AuthStatus.unauthenticated:
          return onLogin ? null : Routes.login;

        case AuthStatus.needsTelegramLink:
          return onConnect ? null : Routes.connectTelegram;

        case AuthStatus.authenticated:
          // Bounce away from the auth/splash screens into the app.
          if (onSplash || onLogin || onConnect) return Routes.home;
          return null;
      }
    },
    routes: [
      GoRoute(
        path: Routes.splash,
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: Routes.login,
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: Routes.connectTelegram,
        builder: (context, state) => const ConnectTelegramScreen(),
      ),

      // Bottom-nav shell.
      StatefulShellRoute.indexedStack(
        parentNavigatorKey: _rootKey,
        builder: (context, state, navigationShell) =>
            HomeShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            navigatorKey: _shellKey,
            routes: [
              GoRoute(
                path: Routes.home,
                builder: (context, state) => const HomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Routes.notifications,
                builder: (context, state) => const NotificationsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Routes.profile,
                builder: (context, state) => const ProfileScreen(),
              ),
            ],
          ),
        ],
      ),

      // Full-screen routes above the shell.
      GoRoute(
        path: '/problem/:id',
        parentNavigatorKey: _rootKey,
        builder: (context, state) =>
            ProblemDetailScreen(problemId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: Routes.submit,
        parentNavigatorKey: _rootKey,
        builder: (context, state) => const SubmitScreen(),
      ),
    ],
  );
});
