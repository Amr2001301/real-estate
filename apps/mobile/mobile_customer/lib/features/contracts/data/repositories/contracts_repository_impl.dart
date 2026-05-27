import 'package:core/core.dart';

import '../../domain/entities/contract.dart';
import '../../domain/repositories/contracts_repository.dart';
import '../datasources/contracts_remote_data_source.dart';
import '../mappers/contract_mapper.dart';

class ContractsRepositoryImpl implements ContractsRepository {
  ContractsRepositoryImpl(this._remote);
  final ContractsRemoteDataSource _remote;

  @override
  Future<Result<List<Contract>>> getMyContracts() {
    return guardApiCall(() async {
      final rows = await _remote.listContracts();
      return rows.map((r) => r.toEntity()).toList();
    });
  }
}
