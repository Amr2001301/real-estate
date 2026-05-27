import 'package:core/core_domain.dart';

import '../entities/contract.dart';
import '../repositories/contracts_repository.dart';

class GetMyContracts implements UseCase<List<Contract>, NoParams> {
  const GetMyContracts(this._repo);
  final ContractsRepository _repo;

  @override
  Future<Result<List<Contract>>> call(NoParams params) => _repo.getMyContracts();
}
