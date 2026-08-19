import 'package:core/core_domain.dart';

import '../../domain/entities/staff_contract.dart';
import '../dtos/contract_dtos.dart';

extension StaffContractRowDtoMapper on StaffContractRowDto {
  StaffContract toEntity() => StaffContract(
        id: id,
        status: signedAt != null ? StaffContractStatus.signed : StaffContractStatus.draft,
        contractNumber: contractNumber,
        customerName: customerName,
        customerPhone: customerPhone,
        unitCode: unitCode,
        unitType: unitType,
        projectName: (projectNameAr != null || projectNameEn != null)
            ? Translatable(ar: projectNameAr ?? '', en: projectNameEn ?? '')
            : null,
        totalAmount: totalAmount,
        signedAt: signedAt != null ? DateTime.tryParse(signedAt!) : null,
        createdAt: createdAt != null ? DateTime.tryParse(createdAt!) : null,
      );
}

extension StaffContractDetailDtoMapper on StaffContractDetailDto {
  StaffContractDetail toDetailEntity() => StaffContractDetail(
        id: id,
        status: signedAt != null ? StaffContractStatus.signed : StaffContractStatus.draft,
        contractNumber: contractNumber,
        customerName: customerName,
        customerPhone: customerPhone,
        unitCode: unitCode,
        unitType: unitType,
        projectName: (projectNameAr != null || projectNameEn != null)
            ? Translatable(ar: projectNameAr ?? '', en: projectNameEn ?? '')
            : null,
        totalAmount: totalAmount,
        signedAt: signedAt != null ? DateTime.tryParse(signedAt!) : null,
        createdAt: createdAt != null ? DateTime.tryParse(createdAt!) : null,
        salesName: salesName,
        downPaymentAmount: downPaymentAmount,
        installmentPlanMonths: installmentPlanMonths,
        installmentPlanMonthlyAmount: installmentPlanMonthlyAmount,
        installments: installments
            .map((i) => ContractInstallment(
                  id: i.id,
                  type: i.type,
                  status: i.status,
                  amount: i.amount,
                  dueDate: i.dueDate != null ? DateTime.tryParse(i.dueDate!) : null,
                ))
            .toList(),
      );
}
