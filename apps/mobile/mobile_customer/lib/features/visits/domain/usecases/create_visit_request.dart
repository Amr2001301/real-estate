import 'package:core/core_domain.dart';

import '../repositories/visits_repository.dart';

class CreateVisitRequest implements UseCase<void, CreateVisitParams> {
  const CreateVisitRequest(this._repo);
  final VisitsRepository _repo;

  @override
  Future<Result<void>> call(CreateVisitParams params) =>
      _repo.createVisitRequest(params);
}
