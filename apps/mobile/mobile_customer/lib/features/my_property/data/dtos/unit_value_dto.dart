import 'package:core/core_domain.dart';

import '../../domain/entities/unit_value.dart';

/// Parses `GET /me/unit-values` → `{ enabled, items: [...] }`. Tolerant: a
/// row missing what the card needs (dates, money) is dropped rather than
/// shown half-filled; numbers may arrive as strings or numbers.
List<UnitValue> parseUnitValues(Map<String, dynamic>? json) {
  if (json == null || json['enabled'] != true) return const [];
  final items = json['items'];
  if (items is! List) return const [];
  return [
    for (final it in items.whereType<Map<String, dynamic>>())
      if (_parse(it) case final UnitValue v) v,
  ];
}

String? _money(Object? v) => switch (v) {
      final String s when double.tryParse(s) != null => s,
      final num n => n.toString(),
      _ => null,
    };

double? _num(Object? v) => switch (v) {
      final num n => n.toDouble(),
      final String s => double.tryParse(s),
      _ => null,
    };

UnitValue? _parse(Map<String, dynamic> j) {
  final purchasedAt = DateTime.tryParse(j['purchasedAt'] as String? ?? '');
  final contractId = j['contractId'] as String?;
  final paid = _money(j['purchasePrice']);
  final paidPerMeter = _money(j['purchasePricePerMeter']);
  final nowPerMeter = _money(j['currentPricePerMeter']);
  final value = _money(j['currentValue']);
  final gain = _money(j['gain']);
  if (contractId == null || purchasedAt == null || paid == null || paidPerMeter == null || nowPerMeter == null || value == null || gain == null) {
    return null;
  }
  final history = <UnitValuePoint>[
    for (final p in (j['history'] as List? ?? const []).whereType<Map<String, dynamic>>())
      if ((DateTime.tryParse(p['date'] as String? ?? ''), _num(p['pricePerMeter'])) case (final DateTime d, final double r))
        UnitValuePoint(date: d, pricePerMeter: r),
  ];
  return UnitValue(
    contractId: contractId,
    unitCode: j['unitCode'] as String? ?? '',
    projectName: Translatable.fromJson(j['projectName']),
    purchasedAt: purchasedAt,
    purchasePrice: paid,
    purchasePricePerMeter: paidPerMeter,
    currentPricePerMeter: nowPerMeter,
    currentValue: value,
    gain: gain,
    gainPct: _num(j['gainPct']) ?? 0,
    history: history,
  );
}
