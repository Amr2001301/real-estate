import 'package:core/core.dart';

import '../../domain/entities/broker_profile.dart';
import '../../domain/repositories/broker_profile_repository.dart';
import '../datasources/broker_profile_remote_data_source.dart';
import '../mappers/broker_profile_mapper.dart';

class BrokerProfileRepositoryImpl implements BrokerProfileRepository {
  BrokerProfileRepositoryImpl(this._remote);
  final BrokerProfileRemoteDataSource _remote;

  @override
  Future<Result<BrokerProfile>> getProfile() {
    return guardApiCall(() async => (await _remote.getProfile()).toEntity());
  }
}
