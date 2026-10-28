import 'package:core/core_domain.dart';

import '../entities/lead.dart';
import '../repositories/leads_repository.dart';

class GetLeads implements UseCase<Paginated<Lead>, LeadsQuery> {
  const GetLeads(this._repo);
  final LeadsRepository _repo;

  @override
  Future<Result<Paginated<Lead>>> call(LeadsQuery params) => _repo.getLeads(params);
}

class GetLeadDetail implements UseCase<LeadDetail, String> {
  const GetLeadDetail(this._repo);
  final LeadsRepository _repo;

  @override
  Future<Result<LeadDetail>> call(String id) => _repo.getLead(id);
}

class UpdateLeadStageParams {
  const UpdateLeadStageParams({
    required this.id,
    required this.stage,
    this.reason,
    this.lostReasonId,
    this.lostNote,
  });
  final String id;
  final String stage;
  final String? reason;

  /// LR1 — why the lead is lost (LOST only), and a word on what happened.
  final String? lostReasonId;
  final String? lostNote;
}

class UpdateLeadStage implements UseCase<void, UpdateLeadStageParams> {
  const UpdateLeadStage(this._repo);
  final LeadsRepository _repo;

  @override
  Future<Result<void>> call(UpdateLeadStageParams params) =>
      _repo.updateStage(
        params.id,
        params.stage,
        reason: params.reason,
        lostReasonId: params.lostReasonId,
        lostNote: params.lostNote,
      );
}

/// LR1 — the company's active lost reasons, for the "why was it lost?" sheet.
class GetLostReasons implements UseCase<List<LostReason>, NoParams> {
  const GetLostReasons(this._repo);
  final LeadsRepository _repo;

  @override
  Future<Result<List<LostReason>>> call(NoParams params) => _repo.getLostReasons();
}

class AddLeadNoteParams {
  const AddLeadNoteParams({required this.id, required this.body});
  final String id;
  final String body;
}

class AddLeadNote implements UseCase<void, AddLeadNoteParams> {
  const AddLeadNote(this._repo);
  final LeadsRepository _repo;

  @override
  Future<Result<void>> call(AddLeadNoteParams params) =>
      _repo.addNote(params.id, params.body);
}

class CreateLead implements UseCase<Lead, NewLead> {
  const CreateLead(this._repo);
  final LeadsRepository _repo;

  @override
  Future<Result<Lead>> call(NewLead params) => _repo.createLead(params);
}
