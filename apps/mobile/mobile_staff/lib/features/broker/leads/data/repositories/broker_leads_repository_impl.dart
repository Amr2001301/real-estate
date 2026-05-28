import 'package:core/core.dart';

import '../../domain/entities/broker_lead.dart';
import '../../domain/repositories/broker_leads_repository.dart';
import '../datasources/broker_leads_remote_data_source.dart';
import '../mappers/broker_lead_mapper.dart';

class BrokerLeadsRepositoryImpl implements BrokerLeadsRepository {
  BrokerLeadsRepositoryImpl(this._remote);
  final BrokerLeadsRemoteDataSource _remote;

  @override
  Future<Result<List<BrokerLead>>> getLeads(BrokerLeadsQuery query) {
    return guardApiCall(() async {
      final rows = await _remote.list(query);
      return rows.map((r) => r.toEntity()).toList();
    });
  }

  @override
  Future<Result<BrokerLeadDetail>> getLead(String id) {
    return guardApiCall(() async => (await _remote.getOne(id)).toEntity());
  }

  @override
  Future<Result<BrokerLead>> createLead(NewBrokerLead input) {
    return guardApiCall(() async => (await _remote.create(input)).toEntity());
  }
}
