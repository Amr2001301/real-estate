import 'package:core/core.dart';

import '../../domain/entities/broker_commission.dart';
import '../../domain/repositories/broker_commissions_repository.dart';
import '../datasources/broker_commissions_remote_data_source.dart';
import '../mappers/broker_commission_mapper.dart';

class BrokerCommissionsRepositoryImpl implements BrokerCommissionsRepository {
  BrokerCommissionsRepositoryImpl(this._remote);
  final BrokerCommissionsRemoteDataSource _remote;

  @override
  Future<Result<List<BrokerCommission>>> getCommissions(BrokerCommissionsQuery query) {
    return guardApiCall(() async {
      final rows = await _remote.list(query);
      return rows.map((r) => r.toEntity()).toList();
    });
  }
}
