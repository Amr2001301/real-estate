import 'package:core/core_domain.dart';

/// One point of the price per meter since the purchase.
class UnitValuePoint extends Equatable {
  const UnitValuePoint({required this.date, required this.pricePerMeter});

  final DateTime date;
  final double pricePerMeter;

  @override
  List<Object?> get props => [date, pricePerMeter];
}

/// «قيمة وحدتك»: an owned unit valued today at the company's current prices
/// against what was paid (`GET /me/unit-values`). Money stays as the API's
/// decimal strings, formatted for display only.
class UnitValue extends Equatable {
  const UnitValue({
    required this.contractId,
    required this.unitCode,
    required this.projectName,
    required this.purchasedAt,
    required this.purchasePrice,
    required this.purchasePricePerMeter,
    required this.currentPricePerMeter,
    required this.currentValue,
    required this.gain,
    required this.gainPct,
    required this.history,
  });

  final String contractId;
  final String unitCode;
  final Translatable projectName;
  final DateTime purchasedAt;
  final String purchasePrice;
  final String purchasePricePerMeter;
  final String currentPricePerMeter;
  final String currentValue;
  final String gain;
  final double gainPct;
  final List<UnitValuePoint> history;

  /// A rise (or no change); a fall shows only when the company chose to show it.
  bool get isUp => (double.tryParse(gain) ?? 0) >= 0;

  @override
  List<Object?> get props => [contractId, currentValue, gain, history];
}
