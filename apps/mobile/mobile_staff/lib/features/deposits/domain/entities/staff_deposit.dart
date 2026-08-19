import 'package:core/core_domain.dart';

enum DepositReviewStatus { pending, approved, rejected }

class StaffDeposit extends Equatable {
  const StaffDeposit({
    required this.id,
    this.amount,
    this.type,
    this.verified = false,
    this.reviewStatus,
    this.paidAt,
    this.contractNumber,
    this.customerName,
    this.unitCode,
    this.installmentDueDate,
  });

  final String id;
  final double? amount;
  final String? type;
  final bool verified;
  final DepositReviewStatus? reviewStatus;
  final DateTime? paidAt;
  final String? contractNumber;
  final String? customerName;
  final String? unitCode;
  final DateTime? installmentDueDate;

  @override
  List<Object?> get props => [id, amount, type, verified, reviewStatus, paidAt];
}
