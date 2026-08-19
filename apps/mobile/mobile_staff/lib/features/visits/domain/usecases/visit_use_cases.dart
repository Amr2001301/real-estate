import 'package:core/core_domain.dart';

import '../entities/visit.dart';
import '../repositories/visits_repository.dart';

class GetVisits implements UseCase<Paginated<Visit>, VisitsQuery> {
  const GetVisits(this._repo);
  final VisitsRepository _repo;

  @override
  Future<Result<Paginated<Visit>>> call(VisitsQuery params) => _repo.getVisits(params);
}

class GetVisitDetail implements UseCase<VisitDetail, String> {
  const GetVisitDetail(this._repo);
  final VisitsRepository _repo;

  @override
  Future<Result<VisitDetail>> call(String id) => _repo.getVisit(id);
}

class CreateVisit implements UseCase<Visit, NewVisit> {
  const CreateVisit(this._repo);
  final VisitsRepository _repo;

  @override
  Future<Result<Visit>> call(NewVisit params) => _repo.createVisit(params);
}

class UpdateVisitStatusParams {
  const UpdateVisitStatusParams({
    required this.id,
    required this.transition,
    this.notes,
    this.reason,
  });
  final String id;
  final VisitTransition transition;
  final String? notes;
  final String? reason;
}

class UpdateVisitStatus implements UseCase<void, UpdateVisitStatusParams> {
  const UpdateVisitStatus(this._repo);
  final VisitsRepository _repo;

  @override
  Future<Result<void>> call(UpdateVisitStatusParams params) => _repo.updateStatus(
        params.id,
        params.transition,
        notes: params.notes,
        reason: params.reason,
      );
}

class RescheduleVisitParams {
  const RescheduleVisitParams({
    required this.id,
    required this.scheduledAt,
    this.salesNotes,
  });
  final String id;
  final DateTime scheduledAt;
  final String? salesNotes;
}

class RescheduleVisit implements UseCase<void, RescheduleVisitParams> {
  const RescheduleVisit(this._repo);
  final VisitsRepository _repo;

  @override
  Future<Result<void>> call(RescheduleVisitParams params) =>
      _repo.reschedule(params.id, params.scheduledAt, salesNotes: params.salesNotes);
}

class AssignVisitParams {
  const AssignVisitParams({required this.id, required this.assignedSalesId});
  final String id;
  final String assignedSalesId;
}

class AssignVisit implements UseCase<void, AssignVisitParams> {
  const AssignVisit(this._repo);
  final VisitsRepository _repo;

  @override
  Future<Result<void>> call(AssignVisitParams params) =>
      _repo.assign(params.id, params.assignedSalesId);
}

class SubmitSalesFeedbackParams {
  const SubmitSalesFeedbackParams({required this.id, this.rating, this.notes});
  final String id;
  final int? rating;
  final String? notes;
}

class SubmitSalesFeedback implements UseCase<void, SubmitSalesFeedbackParams> {
  const SubmitSalesFeedback(this._repo);
  final VisitsRepository _repo;

  @override
  Future<Result<void>> call(SubmitSalesFeedbackParams params) =>
      _repo.submitSalesFeedback(params.id, rating: params.rating, notes: params.notes);
}
