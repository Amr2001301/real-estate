import 'package:core/core_domain.dart';

class StaffContractRowDto {
  const StaffContractRowDto({
    required this.id,
    this.contractNumber,
    this.customerName,
    this.customerPhone,
    this.unitCode,
    this.unitType,
    this.projectNameAr,
    this.projectNameEn,
    this.totalAmount,
    this.signedAt,
    this.createdAt,
  });

  final String id;
  final String? contractNumber;
  final String? customerName;
  final String? customerPhone;
  final String? unitCode;
  final String? unitType;
  final String? projectNameAr;
  final String? projectNameEn;
  final double? totalAmount;
  final String? signedAt;
  final String? createdAt;

  factory StaffContractRowDto.fromJson(Map<String, dynamic> json) {
    final customer = json['customer'] as Map<String, dynamic>?;
    final unit = json['unit'] as Map<String, dynamic>?;
    final project = ((unit?['building'] as Map<String, dynamic>?)?['phase']
            as Map<String, dynamic>?)?['project'] as Map<String, dynamic>?;
    final projectName = Translatable.fromJson(project?['name']);
    return StaffContractRowDto(
      id: json['id'] as String,
      contractNumber: json['contractNumber'] as String?,
      customerName: customer?['fullName'] as String?,
      customerPhone: customer?['phone'] as String?,
      unitCode: unit?['code'] as String?,
      unitType: unit?['type'] as String?,
      projectNameAr: projectName.ar,
      projectNameEn: projectName.en,
      totalAmount: (json['totalAmount'] as num?)?.toDouble(),
      signedAt: json['signedAt'] as String?,
      createdAt: json['createdAt'] as String?,
    );
  }
}

class ContractInstallmentDto {
  const ContractInstallmentDto({
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
  final String? dueDate;

  factory ContractInstallmentDto.fromJson(Map<String, dynamic> json) =>
      ContractInstallmentDto(
        id: json['id'] as String,
        type: json['type'] as String? ?? '',
        status: json['status'] as String? ?? '',
        amount: (json['amount'] as num?)?.toDouble(),
        dueDate: json['dueDate'] as String?,
      );
}

class StaffContractDetailDto extends StaffContractRowDto {
  const StaffContractDetailDto({
    required super.id,
    super.contractNumber,
    super.customerName,
    super.customerPhone,
    super.unitCode,
    super.unitType,
    super.projectNameAr,
    super.projectNameEn,
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
  final List<ContractInstallmentDto> installments;

  factory StaffContractDetailDto.fromJson(Map<String, dynamic> json) {
    final base = StaffContractRowDto.fromJson(json);
    final reservation = json['reservation'] as Map<String, dynamic>?;
    final sales = reservation?['sales'] as Map<String, dynamic>?;
    final plan = json['installmentPlan'] as Map<String, dynamic>?;
    final rawInstallments = plan?['installments'] as List? ?? const [];
    return StaffContractDetailDto(
      id: base.id,
      contractNumber: base.contractNumber,
      customerName: base.customerName,
      customerPhone: base.customerPhone,
      unitCode: base.unitCode,
      unitType: base.unitType,
      projectNameAr: base.projectNameAr,
      projectNameEn: base.projectNameEn,
      totalAmount: base.totalAmount,
      signedAt: base.signedAt,
      createdAt: base.createdAt,
      salesName: sales?['fullName'] as String?,
      downPaymentAmount: (json['downPaymentAmount'] as num?)?.toDouble(),
      installmentPlanMonths: plan?['totalMonths'] as int?,
      installmentPlanMonthlyAmount: (plan?['monthlyAmount'] as num?)?.toDouble(),
      installments: rawInstallments
          .whereType<Map<String, dynamic>>()
          .map(ContractInstallmentDto.fromJson)
          .toList(),
    );
  }
}
