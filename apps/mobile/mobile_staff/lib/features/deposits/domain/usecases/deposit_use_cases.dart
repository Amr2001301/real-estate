import 'package:core/core_domain.dart';

import '../entities/staff_deposit.dart';
import '../repositories/deposits_repository.dart';

class ListDepositsParams {
  const ListDepositsParams({this.q, this.contractId});
  final String? q;
  final String? contractId;
}

class ListDeposits implements UseCase<List<StaffDeposit>, ListDepositsParams> {
  const ListDeposits(this._repo);
  final StaffDepositsRepository _repo;

  @override
  Future<Result<List<StaffDeposit>>> call(ListDepositsParams params) =>
      _repo.listDeposits(q: params.q, contractId: params.contractId);
}

class RecordDepositParams {
  const RecordDepositParams({
    required this.contractId,
    required this.installmentId,
    required this.amount,
    required this.paidAt,
  });
  final String contractId;
  final String installmentId;
  final double amount;
  final DateTime paidAt;
}

class RecordDeposit implements UseCase<void, RecordDepositParams> {
  const RecordDeposit(this._repo);
  final StaffDepositsRepository _repo;

  @override
  Future<Result<void>> call(RecordDepositParams params) =>
      _repo.recordDeposit(
        contractId: params.contractId,
        installmentId: params.installmentId,
        amount: params.amount,
        paidAt: params.paidAt,
      );
}
