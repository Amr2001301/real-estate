import 'package:core/core_domain.dart';

import '../entities/deposit.dart';

abstract interface class DepositsRepository {
  Future<Result<List<Deposit>>> getMyDeposits();
}
