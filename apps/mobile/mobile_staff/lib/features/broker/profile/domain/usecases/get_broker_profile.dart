import 'package:core/core_domain.dart';

import '../entities/broker_profile.dart';
import '../repositories/broker_profile_repository.dart';

class GetBrokerProfile implements UseCase<BrokerProfile, NoParams> {
  const GetBrokerProfile(this._repo);
  final BrokerProfileRepository _repo;

  @override
  Future<Result<BrokerProfile>> call(NoParams params) => _repo.getProfile();
}
