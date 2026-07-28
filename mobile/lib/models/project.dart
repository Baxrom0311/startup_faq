import 'json_utils.dart';

/// A startup proposing to solve a problem (created via /problems/{id}/claim).
class Project {
  const Project({
    required this.id,
    required this.problemId,
    required this.leadId,
    required this.title,
    this.pitch,
    this.repoUrl,
    required this.status,
    required this.createdAt,
  });

  final String id;
  final String problemId;
  final String leadId;
  final String title;
  final String? pitch;
  final String? repoUrl;
  final String status;
  final String createdAt;

  factory Project.fromJson(Map<String, dynamic> j) => Project(
        id: J.str(j['id']),
        problemId: J.str(j['problem_id']),
        leadId: J.str(j['lead_id']),
        title: J.str(j['title']),
        pitch: J.strOrNull(j['pitch']),
        repoUrl: J.strOrNull(j['repo_url']),
        status: J.str(j['status'], 'proposed'),
        createdAt: J.str(j['created_at']),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'problem_id': problemId,
        'lead_id': leadId,
        'title': title,
        'pitch': pitch,
        'repo_url': repoUrl,
        'status': status,
        'created_at': createdAt,
      };
}
