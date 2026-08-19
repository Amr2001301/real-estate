import 'package:core/core.dart';

import '../../domain/entities/visit.dart';
import '../../domain/repositories/visits_repository.dart';
import '../datasources/visits_remote_data_source.dart';
import '../mappers/visit_mapper.dart';

class VisitsRepositoryImpl implements VisitsRepository {
  VisitsRepositoryImpl(this._remote);
  final VisitsRemoteDataSource _remote;

  @override
  Future<Result<Paginated<Visit>>> getVisits(VisitsQuery query) {
    return guardApiCall(() async {
      final page = await _remote.list(query);
      return page.map((r) => r.toEntity());
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

  @override
  Future<Result<void>> reschedule(String id, DateTime scheduledAt, {String? salesNotes}) =>
      guardApiCall(() => _remote.reschedule(id, scheduledAt, salesNotes: salesNotes));

  @override
  Future<Result<void>> assign(String id, String assignedSalesId) =>
      guardApiCall(() => _remote.assign(id, assignedSalesId));

  @override
  Future<Result<void>> submitSalesFeedback(String id, {int? rating, String? notes}) =>
      guardApiCall(() => _remote.salesFeedback(id, rating: rating, notes: notes));
}
