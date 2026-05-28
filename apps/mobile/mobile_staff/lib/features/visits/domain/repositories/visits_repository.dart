import 'package:core/core_domain.dart';

import '../entities/visit.dart';

/// Filters for the visits list. `today` scopes to today's appointments.
class VisitsQuery {
  const VisitsQuery({this.status, this.today = false, this.leadId});
  final String? status;
  final bool today;
  final String? leadId;
}

abstract interface class VisitsRepository {
  Future<Result<List<Visit>>> getVisits(VisitsQuery query);
  Future<Result<VisitDetail>> getVisit(String id);
  Future<Result<Visit>> createVisit(NewVisit input);
  Future<Result<void>> updateStatus(
    String id,
    VisitTransition transition, {
    String? notes,
    String? reason,
  });
}
