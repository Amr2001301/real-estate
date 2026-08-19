import 'package:core/core_domain.dart';

import '../entities/staff_contract.dart';

abstract interface class StaffContractsRepository {
  Future<Result<List<StaffContract>>> listContracts({String? q, String? status});
  Future<Result<StaffContractDetail>> getContract(String id);
}
