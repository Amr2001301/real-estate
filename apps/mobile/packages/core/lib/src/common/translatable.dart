import 'package:equatable/equatable.dart';

/// A bilingual `{ ar, en }` value. Pure Dart (no Flutter) so it can be used by
/// domain entities. Resolves to the active language code, falling back to the
/// other language when one side is empty.
class Translatable extends Equatable {
  const Translatable({required this.ar, required this.en});

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
