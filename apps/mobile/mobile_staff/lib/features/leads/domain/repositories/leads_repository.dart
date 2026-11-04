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
    this.salesId,
    this.unassigned = false,
    this.pageSize = 20,
  });
  final String? stage;
  final String? search;
  final bool mine;
  final int page;
  final String? sourceId;
  final String? dateFrom;
  final String? dateTo;

  /// Managers and admins: one rep's leads.
  final String? salesId;

  /// Managers and admins: the leads nobody owns yet.
  final bool unassigned;
  final int pageSize;

  bool get hasAdvancedFilters => sourceId != null || dateFrom != null || dateTo != null || salesId != null;
}

class NewLead {
  const NewLead({
    this.clientId,
    this.fullName,
    this.phone,
    this.email,
    this.sourceId,
    this.projectInterestId,
    this.unitInterestId,
    this.notes,
    this.campaignId,
    this.allowDuplicate = false,
  });
  final String? clientId;
  final String? fullName;
  final String? phone;
  final String? email;
  final String? sourceId;
  final String? projectInterestId;
  final String? unitInterestId;
  final String? notes;

  /// The marketing campaign that brought the lead.
  final String? campaignId;

  /// DUP2 — add even though the customer already has an open lead.
  final bool allowDuplicate;

  NewLead anyway() => NewLead(
        clientId: clientId,
        fullName: fullName,
        phone: phone,
        email: email,
        sourceId: sourceId,
        projectInterestId: projectInterestId,
        unitInterestId: unitInterestId,
        notes: notes,
        campaignId: campaignId,
        allowDuplicate: true,
      );
}

/// DUP2 — one of the customer's open leads, when adding another was refused.
class OpenLeadRef {
  const OpenLeadRef({required this.id, required this.stage, this.ownerName, this.createdAt});
  final String id;
  final String stage;
  final String? ownerName;
  final DateTime? createdAt;
}

class LeadSource {
  const LeadSource({required this.id, required this.name});
  final String id;
  final String name;
}

class ClientSearchResult {
  const ClientSearchResult({
    required this.id,
    required this.fullName,
    this.phone,
    this.email,
    required this.role,
  });
  final String id;
  final String fullName;
  final String? phone;
  final String? email;
  final String role;
}

/// Passed as route `extra` when navigating to /leads/new from a project or
/// unit detail screen so the interest context is pre-filled.
class LeadInterestContext {
  const LeadInterestContext({
    this.projectId,
    this.projectName,
    this.unitId,
    this.unitCode,
  });
  final String? projectId;
  final String? projectName;
  final String? unitId;
  final String? unitCode;

  bool get hasProject => projectId != null;
  bool get hasUnit => unitId != null;
}

abstract interface class LeadsRepository {
  Future<Result<Paginated<Lead>>> getLeads(LeadsQuery query);
  Future<Result<LeadDetail>> getLead(String id);
  Future<Result<void>> updateStage(String id, String stage, {String? reason, String? lostReasonId, String? lostNote});
  Future<Result<List<LostReason>>> getLostReasons();
  Future<Result<void>> addNote(String id, LeadNoteInput input);
  Future<Result<Paginated<FollowUp>>> getFollowUps(FollowUpBucket bucket, {int page = 1});
  Future<Result<FollowUpSummary>> getFollowUpSummary();
  Future<Result<Lead>> createLead(NewLead input);
  Future<Result<List<LeadSource>>> getSources();
  Future<Result<List<ClientSearchResult>>> searchClients(String q);

  /// How many leads stand in each stage, in the caller's scope — the
  /// website's pipeline counts (`GET /leads/pipeline`).
  Future<Result<Map<String, int>>> getPipeline();

  /// How many leads nobody owns yet (managers and admins).
  Future<Result<int>> countUnassigned();

  /// The sales reps and managers, for the rep filter (managers and admins).
  Future<Result<List<StaffOption>>> getSalesStaff();

  /// A call or WhatsApp press: logged on the lead, returns the phone to dial
  /// (`POST /leads/:id/contact`), as on the website.
  Future<Result<String>> openContact(String id, String kind);
}

/// A sales rep or manager, for pickers.
class StaffOption {
  const StaffOption({required this.id, required this.name});
  final String id;
  final String name;
}
