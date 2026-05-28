import 'package:core/core_domain.dart';

import '../entities/broker_commission.dart';

class BrokerCommissionsQuery {
  const BrokerCommissionsQuery({this.status});
  final String? status;
}

abstract interface class BrokerCommissionsRepository {
  Future<Result<List<BrokerCommission>>> getCommissions(BrokerCommissionsQuery query);
}
