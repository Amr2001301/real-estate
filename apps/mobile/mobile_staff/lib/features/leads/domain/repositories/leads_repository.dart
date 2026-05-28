import 'package:core/core_domain.dart';

import '../entities/lead.dart';

/// Filters for the leads list. `mine` scopes to the signed-in rep's own leads.
class LeadsQuery {
  const LeadsQuery({this.stage, this.search, this.mine = false});
  final String? stage;
  final String? search;
  final bool mine;
}

abstract interface class LeadsRepository {
  Future<Result<List<Lead>>> getLeads(LeadsQuery query);
  Future<Result<LeadDetail>> getLead(String id);
  Future<Result<void>> updateStage(String id, String stage, {String? reason});
  Future<Result<void>> addNote(String id, String body);
}
