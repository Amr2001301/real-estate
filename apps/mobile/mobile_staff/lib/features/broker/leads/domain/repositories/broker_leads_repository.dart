import 'package:core/core_domain.dart';

import '../entities/broker_lead.dart';

class BrokerLeadsQuery {
  const BrokerLeadsQuery({this.approvalStatus, this.search, this.stage});
  final String? approvalStatus;
  final String? search;

  /// The lead's stage in the company's pipeline (NEW … LOST).
  final String? stage;
}

abstract interface class BrokerLeadsRepository {
  Future<Result<List<BrokerLead>>> getLeads(BrokerLeadsQuery query);
  Future<Result<BrokerLeadDetail>> getLead(String id);
  Future<Result<BrokerLead>> createLead(NewBrokerLead input);

  /// How many leads in each approval status (the website's figures).
  Future<Result<BrokerLeadCounts>> getCounts();
}
