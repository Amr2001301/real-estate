import 'package:equatable/equatable.dart';

/// A bilingual `{ ar, en }` value. Pure Dart (no Flutter) so it can be used by
/// domain entities. Resolves to the active language code, falling back to the
/// other language when one side is empty.
class Translatable extends Equatable {
  const Translatable({required this.ar, required this.en});

  /// Tolerant wire parser. The backend's locale interceptor flattens
  /// `{ ar, en }` translatable fields to a plain localized **string** when an
  /// `Accept-Language` header is sent (which the mobile client always does), but
  /// returns the raw `{ ar, en }` map to clients that opt out. This accepts
  /// BOTH shapes (and null) so models never crash with
  /// `type 'String' is not a subtype of type 'Map<String, dynamic>?'`.
  ///
  /// A flattened string `s` becomes `Translatable(ar: s, en: s)` — the backend
  /// already localized to the requested language, so both sides resolve to it.
  factory Translatable.fromJson(Object? json) {
    if (json is Map) {
      return Translatable(
        ar: (json['ar'] as String?)?.trim() ?? '',
        en: (json['en'] as String?)?.trim() ?? '',
      );
    }
    final s = json is String ? json : '';
    return Translatable(ar: s, en: s);
  }

  final String ar;
  final String en;

  String resolve(String languageCode) {
    if (languageCode == 'ar') return ar.isNotEmpty ? ar : en;
    return en.isNotEmpty ? en : ar;
  }

  bool get isEmpty => ar.isEmpty && en.isEmpty;

  @override
  List<Object?> get props => [ar, en];
}
