import 'json_utils.dart';

/// Platform-wide counters shown on the profile / dashboard.
///
/// The backend shape is loose, so raw counts are also retained in [raw]
/// for forward compatibility.
class AnalyticsOverview {
  const AnalyticsOverview({
    required this.problemCount,
    required this.projectCount,
    required this.userCount,
    required this.solvedCount,
    required this.raw,
  });

  final int problemCount;
  final int projectCount;
  final int userCount;
  final int solvedCount;

  /// Full payload for any additional fields the UI may surface later.
  final Map<String, dynamic> raw;

  factory AnalyticsOverview.fromJson(Map<String, dynamic> j) =>
      AnalyticsOverview(
        problemCount: J.intv(j['problem_count'] ?? j['problems']),
        projectCount: J.intv(j['project_count'] ?? j['projects']),
        userCount: J.intv(j['user_count'] ?? j['users']),
        solvedCount: J.intv(j['solved_count'] ?? j['solved']),
        raw: j,
      );

  Map<String, dynamic> toJson() => raw;
}
