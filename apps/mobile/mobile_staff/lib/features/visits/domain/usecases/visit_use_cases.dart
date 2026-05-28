import 'package:core/core_domain.dart';

import '../entities/visit.dart';
import '../repositories/visits_repository.dart';

class GetVisits implements UseCase<List<Visit>, VisitsQuery> {
  const GetVisits(this._repo);
  final VisitsRepository _repo;

  @override
  Future<Result<List<Visit>>> call(VisitsQuery params) => _repo.getVisits(params);
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
