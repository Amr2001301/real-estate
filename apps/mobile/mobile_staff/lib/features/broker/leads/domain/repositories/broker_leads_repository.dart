import 'package:core/core_domain.dart';

import '../entities/broker_lead.dart';

class BrokerLeadsQuery {
  const BrokerLeadsQuery({this.approvalStatus, this.search});
  final String? approvalStatus;
  final String? search;
}

abstract interface class BrokerLeadsRepository {
  Future<Result<List<BrokerLead>>> getLeads(BrokerLeadsQuery query);
  Future<Result<BrokerLeadDetail>> getLead(String id);
  Future<Result<BrokerLead>> createLead(NewBrokerLead input);
}
