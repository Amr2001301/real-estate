import 'package:core/core.dart';

import '../../domain/entities/broker_dashboard.dart';
import '../../domain/repositories/broker_dashboard_repository.dart';
import '../datasources/broker_dashboard_remote_data_source.dart';
import '../mappers/broker_dashboard_mapper.dart';

class BrokerDashboardRepositoryImpl implements BrokerDashboardRepository {
  BrokerDashboardRepositoryImpl(this._remote);
  final BrokerDashboardRemoteDataSource _remote;

  @override
  Future<Result<BrokerDashboard>> getDashboard() {
    return guardApiCall(() async => (await _remote.getDashboard()).toEntity());
  }
}
