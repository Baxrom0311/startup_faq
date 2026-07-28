import 'json_utils.dart';

class Region {
  const Region({
    required this.id,
    required this.name,
    this.parentId,
  });

  final int id;
  final String name;
  final int? parentId;

  factory Region.fromJson(Map<String, dynamic> j) => Region(
        id: J.intv(j['id']),
        name: J.str(j['name']),
        parentId: J.intOrNull(j['parent_id']),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'parent_id': parentId,
      };
}
