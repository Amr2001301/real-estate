import 'package:core/core.dart';

import '../../domain/entities/deposit.dart';
import '../../domain/repositories/deposits_repository.dart';
import '../datasources/deposits_remote_data_source.dart';
import '../mappers/deposit_mapper.dart';

class DepositsRepositoryImpl implements DepositsRepository {
  DepositsRepositoryImpl(this._remote);
  final DepositsRemoteDataSource _remote;

  @override
  Future<Result<List<Deposit>>> getMyDeposits() {
    return guardApiCall(() async {
      final rows = await _remote.listDeposits();
      return rows.map((r) => r.toEntity()).toList();
    });
  }
}
