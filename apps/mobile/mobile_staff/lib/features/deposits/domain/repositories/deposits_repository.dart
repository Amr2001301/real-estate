import 'package:core/core_domain.dart';

import '../entities/staff_deposit.dart';

abstract interface class StaffDepositsRepository {
  Future<Result<List<StaffDeposit>>> listDeposits({String? q, String? contractId});
  Future<Result<void>> recordDeposit({
    required String contractId,
    required String installmentId,
    required double amount,
    required DateTime paidAt,
  });
}
