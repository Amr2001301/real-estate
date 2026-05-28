import 'package:core/core_domain.dart';

/// A broker commission entry (read-only). `status` is BrokerCommissionStatus.
class BrokerCommission extends Equatable {
  const BrokerCommission({
    required this.id,
    required this.status,
    this.grossAmount,
    this.netAmount,
    this.projectName,
    this.createdAt,
  });

  final String id;
  final String status;
  final String? grossAmount;
  final String? netAmount;
  final String? projectName;
  final DateTime? createdAt;

  @override
  List<Object?> get props => [id, status, grossAmount, netAmount, createdAt];
}
