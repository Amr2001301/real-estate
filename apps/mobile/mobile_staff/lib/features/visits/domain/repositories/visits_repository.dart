import 'package:core/core_domain.dart';

import '../entities/visit.dart';

/// Filters for the visits list. `today` scopes to today's appointments.
class VisitsQuery {
  const VisitsQuery({this.status, this.today = false, this.leadId, this.page = 1});
  final String? status;
  final bool today;
  final String? leadId;
  final int page;
}

abstract interface class VisitsRepository {
  Future<Result<Paginated<Visit>>> getVisits(VisitsQuery query);
  Future<Result<VisitDetail>> getVisit(String id);
  Future<Result<Visit>> createVisit(NewVisit input);
  Future<Result<void>> updateStatus(
    String id,
    VisitTransition transition, {
    String? notes,
    String? reason,
  });
  Future<Result<void>> reschedule(String id, DateTime scheduledAt, {String? salesNotes});
  Future<Result<void>> assign(String id, String assignedSalesId);
  Future<Result<void>> submitSalesFeedback(String id, {int? rating, String? notes});
}
