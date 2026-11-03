import 'package:core/core_domain.dart';

import '../entities/contract.dart';
import '../entities/contract_statement.dart';

abstract interface class ContractsRepository {
  Future<Result<List<Contract>>> getMyContracts();
  Future<Result<ContractStatement>> getStatement(String contractId);
}
