import 'package:core/core_domain.dart';

import '../entities/broker_lead.dart';
import '../repositories/broker_leads_repository.dart';

class GetBrokerLeads implements UseCase<List<BrokerLead>, BrokerLeadsQuery> {
  const GetBrokerLeads(this._repo);
  final BrokerLeadsRepository _repo;

  @override
  Future<Result<List<BrokerLead>>> call(BrokerLeadsQuery params) => _repo.getLeads(params);
}

class GetBrokerLeadDetail implements UseCase<BrokerLeadDetail, String> {
  const GetBrokerLeadDetail(this._repo);
  final BrokerLeadsRepository _repo;

  @override
  Future<Result<BrokerLeadDetail>> call(String id) => _repo.getLead(id);
}

class CreateBrokerLead implements UseCase<BrokerLead, NewBrokerLead> {
  const CreateBrokerLead(this._repo);
  final BrokerLeadsRepository _repo;

  @override
  Future<Result<BrokerLead>> call(NewBrokerLead params) => _repo.createLead(params);
}
