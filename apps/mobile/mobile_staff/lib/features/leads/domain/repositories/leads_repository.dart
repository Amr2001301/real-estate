import 'package:core/core_domain.dart';

import '../entities/lead.dart';

/// Filters for the leads list. `mine` scopes to the signed-in rep's own leads.
class LeadsQuery {
  const LeadsQuery({
    this.stage,
    this.search,
    this.mine = false,
    this.page = 1,
    this.sourceId,
    this.dateFrom,
    this.dateTo,
  });
  final String? stage;
  final String? search;
  final bool mine;
  final int page;
  final String? sourceId;
  final String? dateFrom;
  final String? dateTo;

  bool get hasAdvancedFilters => sourceId != null || dateFrom != null || dateTo != null;
}

class NewLead {
  const NewLead({
    required this.fullName,
    this.phone,
    this.email,
    this.notes,
  });
  final String fullName;
  final String? phone;
  final String? email;
  final String? notes;
}

class LeadSource {
  const LeadSource({required this.id, required this.name});
  final String id;
  final String name;
}

abstract interface class LeadsRepository {
  Future<Result<Paginated<Lead>>> getLeads(LeadsQuery query);
  Future<Result<LeadDetail>> getLead(String id);
  Future<Result<void>> updateStage(String id, String stage, {String? reason});
  Future<Result<void>> addNote(String id, String body);
  Future<Result<Lead>> createLead(NewLead input);
  Future<Result<List<LeadSource>>> getSources();
}
