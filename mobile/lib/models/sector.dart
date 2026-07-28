import 'json_utils.dart';

class Sector {
  const Sector({
    required this.id,
    required this.slug,
    required this.nameUz,
    this.nameRu,
    this.nameEn,
    this.icon,
  });

  final int id;
  final String slug;
  final String nameUz;
  final String? nameRu;
  final String? nameEn;
  final String? icon;

  factory Sector.fromJson(Map<String, dynamic> j) => Sector(
        id: J.intv(j['id']),
        slug: J.str(j['slug']),
        nameUz: J.str(j['name_uz']),
        nameRu: J.strOrNull(j['name_ru']),
        nameEn: J.strOrNull(j['name_en']),
        icon: J.strOrNull(j['icon']),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'slug': slug,
        'name_uz': nameUz,
        'name_ru': nameRu,
        'name_en': nameEn,
        'icon': icon,
      };
}
