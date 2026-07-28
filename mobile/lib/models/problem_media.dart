import 'json_utils.dart';

class ProblemMedia {
  const ProblemMedia({
    required this.id,
    this.problemId,
    required this.kind,
    required this.objectKey,
    required this.url,
    required this.createdAt,
  });

  final String id;
  final String? problemId;

  /// "audio" | "photo".
  final String kind;
  final String objectKey;
  final String url;
  final String createdAt;

  bool get isAudio => kind == 'audio';
  bool get isPhoto => kind == 'photo';

  factory ProblemMedia.fromJson(Map<String, dynamic> j) => ProblemMedia(
        id: J.str(j['id']),
        problemId: J.strOrNull(j['problem_id']),
        kind: J.str(j['kind']),
        objectKey: J.str(j['object_key']),
        url: J.str(j['url']),
        createdAt: J.str(j['created_at']),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'problem_id': problemId,
        'kind': kind,
        'object_key': objectKey,
        'url': url,
        'created_at': createdAt,
      };
}
