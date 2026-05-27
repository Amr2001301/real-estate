import 'package:core/core_domain.dart';

import '../entities/deposit.dart';
import '../repositories/deposits_repository.dart';

class GetMyDeposits implements UseCase<List<Deposit>, NoParams> {
  const GetMyDeposits(this._repo);
  final DepositsRepository _repo;

  @override
  Future<Result<List<Deposit>>> call(NoParams params) => _repo.getMyDeposits();
}
