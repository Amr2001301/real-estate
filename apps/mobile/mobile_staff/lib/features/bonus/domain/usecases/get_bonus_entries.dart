import 'package:core/core_domain.dart';

import '../entities/bonus_entry.dart';
import '../repositories/bonus_repository.dart';

class GetBonusEntries implements UseCase<List<BonusEntry>, BonusQuery> {
  const GetBonusEntries(this._repo);
  final BonusRepository _repo;

  @override
  Future<Result<List<BonusEntry>>> call(BonusQuery params) => _repo.getEntries(params);
}

/// Pure aggregation of entries into headline totals. Lives in the domain so the
/// overview is testable without UI.
BonusOverview bonusOverviewOf(List<BonusEntry> entries) {
  var paid = 0.0;
  var pending = 0.0;
  for (final e in entries) {
    final amount = double.tryParse(e.amount) ?? 0;
    if (e.status == 'PAID') {
      paid += amount;
    } else {
      pending += amount; // PENDING + APPROVED
    }
  }
  return BonusOverview(paidTotal: paid, pendingTotal: pending, count: entries.length);
}
