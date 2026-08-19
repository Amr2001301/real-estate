import 'package:core/core_domain.dart';

enum StaffContractStatus { signed, draft }

class ContractInstallment extends Equatable {
  const ContractInstallment({
    required this.id,
    required this.type,
    required this.status,
    this.amount,
    this.dueDate,
  });

  final String id;
  final String type;
  final String status;
  final double? amount;
  final DateTime? dueDate;

  bool get isPaid => status == 'PAID';
  bool get isOverdue => status == 'OVERDUE';

  @override
  List<Object?> get props => [id, type, status, amount, dueDate];
}

class StaffContract extends Equatable {
  const StaffContract({
    required this.id,
    required this.status,
    this.contractNumber,
    this.customerName,
    this.customerPhone,
    this.unitCode,
    this.unitType,
    this.projectName,
    this.totalAmount,
    this.signedAt,
    this.createdAt,
  });

  final String id;
  final StaffContractStatus status;
  final String? contractNumber;
  final String? customerName;
  final String? customerPhone;
  final String? unitCode;
  final String? unitType;
  final Translatable? projectName;
  final double? totalAmount;
  final DateTime? signedAt;
  final DateTime? createdAt;

  @override
  List<Object?> get props => [id, contractNumber, status, signedAt];
}

class StaffContractDetail extends StaffContract {
  const StaffContractDetail({
    required super.id,
    required super.status,
    super.contractNumber,
    super.customerName,
    super.customerPhone,
    super.unitCode,
    super.unitType,
    super.projectName,
    super.totalAmount,
    super.signedAt,
    super.createdAt,
    this.salesName,
    this.downPaymentAmount,
    this.installmentPlanMonths,
    this.installmentPlanMonthlyAmount,
    this.installments = const [],
  });

  final String? salesName;
  final double? downPaymentAmount;
  final int? installmentPlanMonths;
  final double? installmentPlanMonthlyAmount;
  final List<ContractInstallment> installments;
}
