import 'package:core/core.dart';

import '../../domain/entities/staff_deposit.dart';
import '../../domain/repositories/deposits_repository.dart';
import '../datasources/deposits_remote_data_source.dart';
import '../mappers/deposit_mapper.dart';

class StaffDepositsRepositoryImpl implements StaffDepositsRepository {
  StaffDepositsRepositoryImpl(this._ds);
  final StaffDepositsRemoteDataSource _ds;

  @override
  Future<Result<List<StaffDeposit>>> listDeposits({String? q, String? contractId}) =>
      guardApiCall(() async {
        final dtos = await _ds.listDeposits(q: q, contractId: contractId);
        return dtos.map((d) => d.toEntity()).toList();
      });

  @override
  Future<Result<void>> recordDeposit({
    required String contractId,
    required String installmentId,
    required double amount,
    required DateTime paidAt,
  }) =>
      guardApiCall(() => _ds.recordDeposit(
            contractId: contractId,
            installmentId: installmentId,
            amount: amount,
            paidAt: paidAt.toUtc().toIso8601String(),
          ));
}
