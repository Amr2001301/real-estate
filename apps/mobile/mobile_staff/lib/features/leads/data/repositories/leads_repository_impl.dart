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
  Future<Result<void>> updateStage(String id, String stage, {String? reason, String? lostReasonId, String? lostNote}) {
    return guardApiCall(
      () => _remote.updateStage(id, stage, reason, lostReasonId: lostReasonId, lostNote: lostNote),
    );
  }

  @override
  Future<Result<List<LostReason>>> getLostReasons() {
    return guardApiCall(() async {
      final dtos = await _remote.listLostReasons();
      return [for (final d in dtos) LostReason(id: d.id, name: d.name)];
    });
  }

  @override
  Future<Result<void>> addNote(String id, LeadNoteInput input) {
    return guardApiCall(() => _remote.addNote(id, input));
  }

  @override
  Future<Result<Paginated<FollowUp>>> getFollowUps(FollowUpBucket bucket, {int page = 1}) {
    return guardApiCall(() async {
      final paged = await _remote.listFollowUps(bucket, page: page);
      return paged.map((r) => r.toEntity());
    });
  }

  @override
  Future<Result<FollowUpSummary>> getFollowUpSummary() {
    return guardApiCall(() async {
      final dto = await _remote.followUpSummary();
      return FollowUpSummary(overdue: dto.overdue, today: dto.today, upcoming: dto.upcoming);
    });
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

  @override
  Future<Result<Map<String, int>>> getPipeline() => guardApiCall(_remote.pipeline);

  @override
  Future<Result<int>> countUnassigned() => guardApiCall(_remote.countUnassigned);

  @override
  Future<Result<List<StaffOption>>> getSalesStaff() => guardApiCall(_remote.salesStaff);

  @override
  Future<Result<String>> openContact(String id, String kind) => guardApiCall(() => _remote.openContact(id, kind));

  @override
  Future<Result<LeadLinks>> getLeadLinks(String id) => guardApiCall(() => _remote.links(id));

  @override
  Future<Result<void>> assignLead(String id, String salesId) => guardApiCall(() => _remote.assign(id, salesId));
}
