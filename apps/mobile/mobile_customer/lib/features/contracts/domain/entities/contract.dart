import 'package:core/core_domain.dart';

/// Whether a contract has been signed (owned) or is still a draft/pending.
enum ContractStatus { signed, draft }

/// A customer's contract on a unit. Domain entity (derived from /me/contracts).
class Contract extends Equatable {
  const Contract({
    required this.id,
    required this.unitCode,
    required this.unitType,
    required this.projectName,
    required this.status,
    this.contractNumber,
    this.signedAt,
    this.createdAt,
  });

  final String id;
  final String? contractNumber;
  final String unitCode;
  final String unitType;
  final Translatable projectName;
  final ContractStatus status;
  final DateTime? signedAt;
  final DateTime? createdAt;

  @override
  List<Object?> get props => [id, contractNumber, unitCode, status, signedAt];
}
