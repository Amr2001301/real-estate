import 'package:core/core.dart';

import '../../domain/entities/staff_contract.dart';
import '../../domain/repositories/contracts_repository.dart';
import '../datasources/contracts_remote_data_source.dart';
import '../mappers/contract_mapper.dart';

class StaffContractsRepositoryImpl implements StaffContractsRepository {
  StaffContractsRepositoryImpl(this._ds);
  final StaffContractsRemoteDataSource _ds;

  @override
  Future<Result<List<StaffContract>>> listContracts({String? q, String? status}) =>
      guardApiCall(() async {
        final dtos = await _ds.listContracts(q: q, status: status);
        return dtos.map((d) => d.toEntity()).toList();
      });

  @override
  Future<Result<StaffContractDetail>> getContract(String id) =>
      guardApiCall(() async {
        final dto = await _ds.getContract(id);
        return dto.toDetailEntity();
      });
}
