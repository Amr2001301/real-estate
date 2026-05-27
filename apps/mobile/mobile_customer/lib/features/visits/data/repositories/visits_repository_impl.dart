import 'package:core/core.dart';

import '../../domain/entities/visit_request.dart';
import '../../domain/repositories/visits_repository.dart';
import '../datasources/visits_remote_data_source.dart';
import '../mappers/visit_request_mapper.dart';

class VisitsRepositoryImpl implements VisitsRepository {
  VisitsRepositoryImpl(this._remote);
  final VisitsRemoteDataSource _remote;

  @override
  Future<Result<void>> createVisitRequest(CreateVisitParams params) {
    return guardApiCall(() => _remote.create({
          'projectId': params.projectId,
          'unitId': ?params.unitId,
          'preferredDate': params.preferredDate.toIso8601String(),
          'notes': ?params.notes,
        }));
  }

  @override
  Future<Result<Paginated<VisitRequest>>> getMyVisitRequests({
    int page = 1,
    int pageSize = 20,
  }) {
    return guardApiCall(() async {
      final dtoPage = await _remote.listMine(page, pageSize);
      return dtoPage.map((dto) => dto.toEntity());
    });
  }
}
