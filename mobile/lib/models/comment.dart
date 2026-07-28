import 'json_utils.dart';

/// A discussion / live-chat message on a problem.
class Comment {
  const Comment({
    required this.id,
    required this.problemId,
    required this.userId,
    this.authorName,
    required this.text,
    this.parentId,
    required this.createdAt,
  });

  final String id;
  final String problemId;
  final String userId;
  final String? authorName;
  final String text;
  final String? parentId;
  final String createdAt;

  factory Comment.fromJson(Map<String, dynamic> j) => Comment(
        id: J.str(j['id']),
        problemId: J.str(j['problem_id']),
        userId: J.str(j['user_id']),
        authorName: J.strOrNull(j['author_name']),
        text: J.str(j['text']),
        parentId: J.strOrNull(j['parent_id']),
        createdAt: J.str(j['created_at']),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'problem_id': problemId,
        'user_id': userId,
        'author_name': authorName,
        'text': text,
        'parent_id': parentId,
        'created_at': createdAt,
      };
}
