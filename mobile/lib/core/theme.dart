import 'package:flutter/material.dart';

/// Semantic color palette for SolutionLab, inspired by Uzbek majolica
/// (blue + gold). Exposed as a [ThemeExtension] so widgets can read
/// brightness-correct role colors via `AppColors.of(context)`.
@immutable
class AppColors extends ThemeExtension<AppColors> {
  const AppColors({
    required this.bg,
    required this.surface,
    required this.ink,
    required this.muted,
    required this.line,
    required this.brand,
    required this.gold,
    required this.green,
    required this.owner,
    required this.citizen,
    required this.startup,
  });

  final Color bg;
  final Color surface;
  final Color ink;
  final Color muted;
  final Color line;

  /// Brand / primary (majolica blue).
  final Color brand;

  /// Accent gold — startups / solutions.
  final Color gold;

  /// Green — citizens.
  final Color green;

  // ---- Role color coding (critical to the product) ----------------------
  /// Problem owner = blue.
  final Color owner;

  /// Citizen = green.
  final Color citizen;

  /// Startup = gold.
  final Color startup;

  static const AppColors light = AppColors(
    bg: Color(0xFFFBFAF7),
    surface: Color(0xFFFFFFFF),
    ink: Color(0xFF1A1C28),
    muted: Color(0xFF6B7180),
    line: Color(0x1A1A1C28), // rgba(26,28,40,.10)
    brand: Color(0xFF175A86),
    gold: Color(0xFFA9781F),
    green: Color(0xFF2C8360),
    owner: Color(0xFF175A86),
    citizen: Color(0xFF2C8360),
    startup: Color(0xFFA9781F),
  );

  static const AppColors dark = AppColors(
    bg: Color(0xFF0F1626),
    surface: Color(0xFF151D2F),
    ink: Color(0xFFEEF2F8),
    muted: Color(0xFF98A3B6),
    line: Color(0x1AFFFFFF), // rgba(255,255,255,.10)
    brand: Color(0xFF4AA0D6),
    gold: Color(0xFFD9B45F),
    green: Color(0xFF5FC394),
    owner: Color(0xFF4AA0D6),
    citizen: Color(0xFF5FC394),
    startup: Color(0xFFD9B45F),
  );

  /// Convenience accessor. Falls back to [light] if the extension is missing.
  static AppColors of(BuildContext context) =>
      Theme.of(context).extension<AppColors>() ?? light;

  @override
  AppColors copyWith({
    Color? bg,
    Color? surface,
    Color? ink,
    Color? muted,
    Color? line,
    Color? brand,
    Color? gold,
    Color? green,
    Color? owner,
    Color? citizen,
    Color? startup,
  }) {
    return AppColors(
      bg: bg ?? this.bg,
      surface: surface ?? this.surface,
      ink: ink ?? this.ink,
      muted: muted ?? this.muted,
      line: line ?? this.line,
      brand: brand ?? this.brand,
      gold: gold ?? this.gold,
      green: green ?? this.green,
      owner: owner ?? this.owner,
      citizen: citizen ?? this.citizen,
      startup: startup ?? this.startup,
    );
  }

  @override
  AppColors lerp(ThemeExtension<AppColors>? other, double t) {
    if (other is! AppColors) return this;
    return AppColors(
      bg: Color.lerp(bg, other.bg, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      ink: Color.lerp(ink, other.ink, t)!,
      muted: Color.lerp(muted, other.muted, t)!,
      line: Color.lerp(line, other.line, t)!,
      brand: Color.lerp(brand, other.brand, t)!,
      gold: Color.lerp(gold, other.gold, t)!,
      green: Color.lerp(green, other.green, t)!,
      owner: Color.lerp(owner, other.owner, t)!,
      citizen: Color.lerp(citizen, other.citizen, t)!,
      startup: Color.lerp(startup, other.startup, t)!,
    );
  }
}

/// Author roles used across the product for color coding.
enum AppRole { owner, citizen, startup }

extension AppRoleColor on AppRole {
  Color color(AppColors c) => switch (this) {
        AppRole.owner => c.owner,
        AppRole.citizen => c.citizen,
        AppRole.startup => c.startup,
      };

  /// Uzbek label for the role.
  String get labelUz => switch (this) {
        AppRole.owner => 'Muallif',
        AppRole.citizen => 'Fuqaro',
        AppRole.startup => 'Startap',
      };
}

/// Builds the app themes.
class AppTheme {
  AppTheme._();

  static const double radius = 16;
  static const double radiusSm = 12;
  static const double radiusLg = 22;

  static ThemeData light() => _build(Brightness.light, AppColors.light);
  static ThemeData dark() => _build(Brightness.dark, AppColors.dark);

  static ThemeData _build(Brightness brightness, AppColors c) {
    final scheme = ColorScheme.fromSeed(
      seedColor: c.brand,
      brightness: brightness,
    ).copyWith(
      primary: c.brand,
      secondary: c.gold,
      tertiary: c.green,
      surface: c.surface,
      onSurface: c.ink,
      outline: c.line,
    );

    final base = ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor: c.bg,
      extensions: <ThemeExtension<dynamic>>[c],
    );

    // Tabular figures for counts / numbers.
    final textTheme = base.textTheme.apply(
      bodyColor: c.ink,
      displayColor: c.ink,
    );

    return base.copyWith(
      textTheme: textTheme,
      appBarTheme: AppBarTheme(
        backgroundColor: c.bg,
        foregroundColor: c.ink,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: textTheme.titleLarge?.copyWith(
          fontWeight: FontWeight.w700,
          color: c.ink,
        ),
      ),
      cardTheme: CardThemeData(
        color: c.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radius),
          side: BorderSide(color: c.line),
        ),
      ),
      dividerTheme: DividerThemeData(color: c.line, thickness: 1, space: 1),
      chipTheme: base.chipTheme.copyWith(
        backgroundColor: c.surface,
        side: BorderSide(color: c.line),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(999),
        ),
        labelStyle: textTheme.labelMedium,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: c.surface,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radius),
          borderSide: BorderSide(color: c.line),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radius),
          borderSide: BorderSide(color: c.line),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radius),
          borderSide: BorderSide(color: c.brand, width: 1.6),
        ),
        hintStyle: textTheme.bodyMedium?.copyWith(color: c.muted),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: c.brand,
          foregroundColor: Colors.white,
          minimumSize: const Size(0, 52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radius),
          ),
          textStyle:
              textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: c.brand,
          minimumSize: const Size(0, 52),
          side: BorderSide(color: c.line),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radius),
          ),
          textStyle:
              textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: c.brand),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: c.brand,
        foregroundColor: Colors.white,
        extendedTextStyle:
            textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusLg),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: c.surface,
        indicatorColor: c.brand.withValues(alpha: 0.14),
        labelTextStyle: WidgetStatePropertyAll(textTheme.labelMedium),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(color: selected ? c.brand : c.muted);
        }),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: c.ink,
        contentTextStyle: textTheme.bodyMedium?.copyWith(color: c.bg),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusSm),
        ),
      ),
    );
  }
}
