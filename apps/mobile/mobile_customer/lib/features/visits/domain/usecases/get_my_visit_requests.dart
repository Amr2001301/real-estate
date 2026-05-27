import 'package:core/core_domain.dart';

import '../entities/visit_request.dart';
import '../repositories/visits_repository.dart';

class GetMyVisitRequests implements UseCase<Paginated<VisitRequest>, int> {
  const GetMyVisitRequests(this._repo);
  final VisitsRepository _repo;

  @override
  Future<Result<Paginated<VisitRequest>>> call(int page) =>
      _repo.getMyVisitRequests(page: page, pageSize: 20);
}
