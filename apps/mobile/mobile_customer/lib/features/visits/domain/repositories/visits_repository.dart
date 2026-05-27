import 'package:core/core_domain.dart';

import '../entities/visit_request.dart';

class CreateVisitParams {
  const CreateVisitParams({
    required this.projectId,
    required this.preferredDate,
    this.unitId,
    this.notes,
  });
  final String projectId;
  final String? unitId;
  final DateTime preferredDate;
  final String? notes;
}

abstract interface class VisitsRepository {
  Future<Result<void>> createVisitRequest(CreateVisitParams params);
  Future<Result<Paginated<VisitRequest>>> getMyVisitRequests({
    int page,
    int pageSize,
  });
}
