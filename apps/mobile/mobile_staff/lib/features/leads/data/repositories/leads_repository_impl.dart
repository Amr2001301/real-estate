import 'package:core/core.dart';

import '../../domain/entities/lead.dart';
import '../../domain/repositories/leads_repository.dart';
import '../datasources/leads_remote_data_source.dart';
import '../mappers/lead_mapper.dart';

class LeadsRepositoryImpl implements LeadsRepository {
  LeadsRepositoryImpl(this._remote);
  final LeadsRemoteDataSource _remote;

  @override
  Future<Result<Paginated<Lead>>> getLeads(LeadsQuery query) {
    return guardApiCall(() async {
      final page = await _remote.list(query);
      return page.map((r) => r.toEntity());
    });
  }

  @override
  Future<Result<LeadDetail>> getLead(String id) {
    return guardApiCall(() async => (await _remote.getOne(id)).toEntity());
  }

  @override
  Future<Result<void>> updateStage(String id, String stage, {String? reason}) {
    return guardApiCall(() => _remote.updateStage(id, stage, reason));
  }

  @override
  Future<Result<void>> addNote(String id, String body) {
    return guardApiCall(() => _remote.addNote(id, body));
  }

  @override
  Future<Result<Lead>> createLead(NewLead input) {
    return guardApiCall(() async => (await _remote.create(input)).toEntity());
  }

  @override
  Future<Result<List<LeadSource>>> getSources() {
    return guardApiCall(() async {
      final dtos = await _remote.listSources();
      return dtos.map((d) => LeadSource(id: d.id, name: d.name)).toList();
    });
  }

  @override
  Future<Result<List<ClientSearchResult>>> searchClients(String q) {
    return guardApiCall(() async {
      final dtos = await _remote.searchClients(q);
      return dtos
          .map((d) => ClientSearchResult(
                id: d.id,
                fullName: d.fullName,
                phone: d.phone,
                email: d.email,
                role: d.role,
              ))
          .toList();
    });
  }
}
