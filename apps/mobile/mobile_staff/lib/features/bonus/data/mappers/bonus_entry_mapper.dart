import '../../domain/entities/bonus_entry.dart';
import '../dtos/bonus_entry_dto.dart';

extension BonusEntryDtoMapper on BonusEntryDto {
  BonusEntry toEntity() => BonusEntry(
        id: id,
        amount: amount,
        period: period,
        status: status,
        ruleName: ruleName,
        commissionPct: commissionPct,
        paidAt: DateTime.tryParse(paidAt ?? ''),
        createdAt: DateTime.tryParse(createdAt ?? ''),
      );
}
