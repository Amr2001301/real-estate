import 'package:core/core_domain.dart';

import '../entities/contract.dart';

abstract interface class ContractsRepository {
  Future<Result<List<Contract>>> getMyContracts();
}
