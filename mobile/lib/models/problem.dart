import 'json_utils.dart';

/// A civic problem submitted by a citizen.
class Problem {
  const Problem({
    required this.id,
    required this.authorId,
    this.authorName,
    this.title,
    this.rawText,
    this.rawAudioKey,
    this.structuredDesc,
    this.duplicateOf,
    this.isDuplicate = false,
    required this.status,
    this.voteCount = 0,
    this.commentCount = 0,
    this.projectCount = 0,
    this.hasVoted = false,
    this.severityScore,
    this.sectorId,
    this.regionId,
    required this.createdAt,
  });

  final String id;
  final String authorId;
  final String? authorName;
  final String? title;
  final String? rawText;
  final String? rawAudioKey;
  final Map<String, dynamic>? structuredDesc;
  final String? duplicateOf;
  final bool isDuplicate;
  final String status;
  final int voteCount;
  final int commentCount;
  final int projectCount;
  final bool hasVoted;
  final double? severityScore;
  final int? sectorId;
  final int? regionId;
  final String createdAt;

  factory Problem.fromJson(Map<String, dynamic> j) => Problem(
        id: J.str(j['id']),
        authorId: J.str(j['author_id']),
        authorName: J.strOrNull(j['author_name']),
        title: J.strOrNull(j['title']),
        rawText: J.strOrNull(j['raw_text']),
        rawAudioKey: J.strOrNull(j['raw_audio_key']),
        structuredDesc: J.mapOrNull(j['structured_desc']),
        duplicateOf: J.strOrNull(j['duplicate_of']),
        isDuplicate: J.boolv(j['is_duplicate']),
        status: J.str(j['status'], 'draft'),
        voteCount: J.intv(j['vote_count']),
        commentCount: J.intv(j['comment_count']),
        projectCount: J.intv(j['project_count']),
        hasVoted: J.boolv(j['has_voted']),
        severityScore: J.doubleOrNull(j['severity_score']),
        sectorId: J.intOrNull(j['sector_id']),
        regionId: J.intOrNull(j['region_id']),
        createdAt: J.str(j['created_at']),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'author_id': authorId,
        'author_name': authorName,
        'title': title,
        'raw_text': rawText,
        'raw_audio_key': rawAudioKey,
        'structured_desc': structuredDesc,
        'duplicate_of': duplicateOf,
        'is_duplicate': isDuplicate,
        'status': status,
        'vote_count': voteCount,
        'comment_count': commentCount,
        'project_count': projectCount,
        'has_voted': hasVoted,
        'severity_score': severityScore,
        'sector_id': sectorId,
        'region_id': regionId,
        'created_at': createdAt,
      };

  Problem copyWith({
    int? voteCount,
    bool? hasVoted,
    int? commentCount,
    int? projectCount,
    String? status,
  }) =>
      Problem(
        id: id,
        authorId: authorId,
        authorName: authorName,
        title: title,
        rawText: rawText,
        rawAudioKey: rawAudioKey,
        structuredDesc: structuredDesc,
        duplicateOf: duplicateOf,
        isDuplicate: isDuplicate,
        status: status ?? this.status,
        voteCount: voteCount ?? this.voteCount,
        commentCount: commentCount ?? this.commentCount,
        projectCount: projectCount ?? this.projectCount,
        hasVoted: hasVoted ?? this.hasVoted,
        severityScore: severityScore,
        sectorId: sectorId,
        regionId: regionId,
        createdAt: createdAt,
      );
}
