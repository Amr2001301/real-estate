import 'package:core/core_domain.dart';

/// A broker-submitted lead. `stage` is the sales pipeline wire value;
/// `approvalStatus` is the broker approval wire value (BrokerLeadStatus).
class BrokerLead extends Equatable {
  const BrokerLead({
    required this.id,
    required this.fullName,
    required this.stage,
    required this.approvalStatus,
    this.phone,
    this.email,
    this.projectName,
    this.createdAt,
  });

  final String id;
  final String fullName;
  final String stage;
  final String approvalStatus;
  final String? phone;
  final String? email;
  final String? projectName;
  final DateTime? createdAt;

  @override
  List<Object?> get props => [id, fullName, stage, approvalStatus, createdAt];
}

/// A timeline entry (note or activity) on a broker lead.
class BrokerLeadTimelineEntry extends Equatable {
  const BrokerLeadTimelineEntry({
    required this.id,
    required this.body,
    required this.isNote,
    this.authorName,
    this.createdAt,
  });

  final String id;
  final String body;
  final bool isNote;
  final String? authorName;
  final DateTime? createdAt;

  @override
  List<Object?> get props => [id, body, isNote, createdAt];
}

class BrokerLeadDetail extends Equatable {
  const BrokerLeadDetail({required this.lead, required this.timeline, this.unitCode});
  final BrokerLead lead;
  final List<BrokerLeadTimelineEntry> timeline;
  final String? unitCode;

  @override
  List<Object?> get props => [lead, timeline, unitCode];
}

/// Input for creating a broker lead (POST /portal/leads).
class NewBrokerLead {
  const NewBrokerLead({
    required this.fullName,
    required this.phone,
    this.email,
    this.projectInterestId,
    this.unitInterestId,
    this.note,
  });

  final String fullName;
  final String phone;
  final String? email;
  final String? projectInterestId;
  final String? unitInterestId;
  final String? note;
}
