import 'package:core/core_domain.dart';

import '../entities/broker_profile.dart';

abstract interface class BrokerProfileRepository {
  Future<Result<BrokerProfile>> getProfile();
}
