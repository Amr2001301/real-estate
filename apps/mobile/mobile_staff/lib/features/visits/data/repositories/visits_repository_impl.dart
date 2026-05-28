import 'package:core/core.dart';

import '../../domain/entities/visit.dart';
import '../../domain/repositories/visits_repository.dart';
import '../datasources/visits_remote_data_source.dart';
import '../mappers/visit_mapper.dart';

class VisitsRepositoryImpl implements VisitsRepository {
  VisitsRepositoryImpl(this._remote);
  final VisitsRemoteDataSource _remote;

  @override
  Future<Result<List<Visit>>> getVisits(VisitsQuery query) {
    return guardApiCall(() async {
      final rows = await _remote.list(query);
      return rows.map((r) => r.toEntity()).toList();
    });
  }

  @override
  Future<Result<VisitDetail>> getVisit(String id) {
    return guardApiCall(() async => (await _remote.getOne(id)).toEntity());
  }

  @override
  Future<Result<Visit>> createVisit(NewVisit input) {
    return guardApiCall(() async => (await _remote.create(input)).toEntity());
  }

  @override
  Future<Result<void>> updateStatus(
    String id,
    VisitTransition transition, {
    String? notes,
    String? reason,
  }) {
    return guardApiCall(() => _remote.transition(id, transition, notes, reason));
  }
}
