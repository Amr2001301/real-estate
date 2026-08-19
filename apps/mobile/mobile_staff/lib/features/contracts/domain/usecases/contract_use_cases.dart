import 'package:core/core_domain.dart';

import '../entities/staff_contract.dart';
import '../repositories/contracts_repository.dart';

class ListContractsParams {
  const ListContractsParams({this.q, this.status});
  final String? q;
  final String? status;
}

class ListContracts implements UseCase<List<StaffContract>, ListContractsParams> {
  const ListContracts(this._repo);
  final StaffContractsRepository _repo;

  @override
  Future<Result<List<StaffContract>>> call(ListContractsParams params) =>
      _repo.listContracts(q: params.q, status: params.status);
}

class GetContractDetail implements UseCase<StaffContractDetail, String> {
  const GetContractDetail(this._repo);
  final StaffContractsRepository _repo;

  @override
  Future<Result<StaffContractDetail>> call(String id) => _repo.getContract(id);
}
