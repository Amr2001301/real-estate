import 'package:core/core_domain.dart';

import '../entities/broker_commission.dart';
import '../repositories/broker_commissions_repository.dart';

class GetBrokerCommissions implements UseCase<List<BrokerCommission>, BrokerCommissionsQuery> {
  const GetBrokerCommissions(this._repo);
  final BrokerCommissionsRepository _repo;

  @override
  Future<Result<List<BrokerCommission>>> call(BrokerCommissionsQuery params) =>
      _repo.getCommissions(params);
}

/// Sum of net (or gross) commission amounts by paid-ness for the overview.
({double approved, double pending}) brokerCommissionTotals(List<BrokerCommission> items) {
  var approved = 0.0;
  var pending = 0.0;
  for (final c in items) {
    final amount = double.tryParse(c.netAmount ?? c.grossAmount ?? '') ?? 0;
    if (c.status == 'APPROVED') {
      approved += amount;
    } else if (c.status == 'PENDING') {
      pending += amount;
    }
  }
  return (approved: approved, pending: pending);
}
