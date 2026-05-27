import 'package:core/core_domain.dart';

/// Ownership state of a property (derived from the contract's signed status).
enum PropertyStatus { owned, pending }

/// A customer's property — derived from a contract on a unit. Domain entity.
class Property extends Equatable {
  const Property({
    required this.contractId,
    required this.unitId,
    required this.unitCode,
    required this.unitType,
    required this.projectName,
    required this.status,
    this.contractNumber,
    this.projectId,
    this.signedAt,
    this.reservationNumber,
    this.monthlyAmount,
    this.totalMonths,
  });

  final String contractId;
  final String? contractNumber;
  final String unitId;
  final String unitCode;
  final String unitType;
  final String? projectId;
  final Translatable projectName;
  final PropertyStatus status;
  final DateTime? signedAt;
  final String? reservationNumber;
  final String? monthlyAmount;
  final int? totalMonths;

  bool get hasInstallmentPlan => totalMonths != null && totalMonths! > 0;

  @override
  List<Object?> get props => [contractId, unitId, unitCode, status, signedAt];
}
