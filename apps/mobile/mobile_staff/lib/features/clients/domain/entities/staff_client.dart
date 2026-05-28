import 'package:core/core_domain.dart';

/// A client (contact) the sales rep works with. Derived from the rep's lead
/// book — there is no first-class sales clients endpoint (see readiness doc).
class StaffClient extends Equatable {
  const StaffClient({
    required this.clientId,
    required this.fullName,
    required this.leadCount,
    required this.latestStage,
    this.phone,
    this.email,
  });

  final String clientId;
  final String fullName;
  final int leadCount;
  final String latestStage;
  final String? phone;
  final String? email;

  @override
  List<Object?> get props => [clientId, fullName, leadCount, latestStage, phone, email];
}

/// A pointer from a client to one of their leads (for the detail timeline link).
class ClientLeadRef extends Equatable {
  const ClientLeadRef({
    required this.leadId,
    required this.stage,
    this.projectInterest,
    this.createdAt,
  });

  final String leadId;
  final String stage;
  final String? projectInterest;
  final DateTime? createdAt;

  @override
  List<Object?> get props => [leadId, stage, projectInterest, createdAt];
}

/// A client plus the leads they're attached to.
class ClientDetail extends Equatable {
  const ClientDetail({required this.client, required this.leads});
  final StaffClient client;
  final List<ClientLeadRef> leads;

  @override
  List<Object?> get props => [client, leads];
}
