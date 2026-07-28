import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:solutionlab/core/storage.dart';
import 'package:solutionlab/core/api_client.dart';
import 'package:solutionlab/main.dart';

void main() {
  testWidgets('App boots to the splash/login flow', (tester) async {
    final storage = TokenStorage();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [tokenStorageProvider.overrideWithValue(storage)],
        child: const SolutionLabApp(),
      ),
    );
    await tester.pump();

    // A MaterialApp.router should be present.
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
