/// Small null-safe JSON coercion helpers shared by manual model parsers.
class J {
  J._();

  static String str(dynamic v, [String fallback = '']) =>
      v == null ? fallback : v.toString();

  static String? strOrNull(dynamic v) => v?.toString();

  static int intv(dynamic v, [int fallback = 0]) {
    if (v is int) return v;
    if (v is num) return v.toInt();
    if (v is String) return int.tryParse(v) ?? fallback;
    return fallback;
  }

  static int? intOrNull(dynamic v) {
    if (v == null) return null;
    if (v is int) return v;
    if (v is num) return v.toInt();
    if (v is String) return int.tryParse(v);
    return null;
  }

  static double? doubleOrNull(dynamic v) {
    if (v == null) return null;
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v);
    return null;
  }

  static bool boolv(dynamic v, [bool fallback = false]) {
    if (v is bool) return v;
    if (v is num) return v != 0;
    if (v is String) return v == 'true' || v == '1';
    return fallback;
  }

  static Map<String, dynamic>? mapOrNull(dynamic v) =>
      v is Map ? Map<String, dynamic>.from(v) : null;

  static Map<String, dynamic> map(dynamic v) =>
      v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};

  static List<String> stringList(dynamic v) =>
      v is List ? v.map((e) => e.toString()).toList() : <String>[];
}
