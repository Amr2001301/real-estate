import 'package:core/core_domain.dart';

/// Parses a backend `{ ar, en }` (or plain string) payload into [Translatable].
/// Lives in the data layer because it's a wire-format concern.
Translatable translatableFromJson(Object? json) {
  if (json is Map) {
    return Translatable(
      ar: (json['ar'] as String?)?.trim() ?? '',
      en: (json['en'] as String?)?.trim() ?? '',
    );
  }
  final s = json is String ? json : '';
  return Translatable(ar: s, en: s);
}
