import 'package:core/core.dart';

import '../../domain/entities/lead.dart';
import '../../domain/repositories/leads_repository.dart';
import '../datasources/leads_remote_data_source.dart';
import '../mappers/lead_mapper.dart';

class LeadsRepositoryImpl implements LeadsRepository {
  LeadsRepositoryImpl(this._remote);
  final LeadsRemoteDataSource _remote;

  @override
  Future<Result<List<Lead>>> getLeads(LeadsQuery query) {
    return guardApiCall(() async {
      final rows = await _remote.list(query);
      return rows.map((r) => r.toEntity()).toList();
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
}
