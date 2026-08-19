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
  const UpdateLeadStageParams({required this.id, required this.stage, this.reason});
  final String id;
  final String stage;
  final String? reason;
}

class UpdateLeadStage implements UseCase<void, UpdateLeadStageParams> {
  const UpdateLeadStage(this._repo);
  final LeadsRepository _repo;

  @override
  Future<Result<void>> call(UpdateLeadStageParams params) =>
      _repo.updateStage(params.id, params.stage, reason: params.reason);
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
