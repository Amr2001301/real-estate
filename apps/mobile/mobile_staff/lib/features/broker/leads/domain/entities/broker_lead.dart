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
    this.projectCity,
    this.unitCode,
    this.unitType,
    this.assignedSalesName,
    this.submittedAt,
    this.approvedAt,
    this.rejectedAt,
    this.rejectionReason,
  });

  final String id;
  final String fullName;
  final String stage;
  final String approvalStatus;
  final String? phone;
  final String? email;
  final String? projectName;
  final DateTime? createdAt;
  final String? projectCity;

  /// The unit asked for; none means any unit.
  final String? unitCode;
  final String? unitType;

  /// The company's rep who follows the lead.
  final String? assignedSalesName;

  /// When it was sent (the website shows this, else when it was created),
  /// approved or rejected, and why it was rejected.
  final DateTime? submittedAt;
  final DateTime? approvedAt;
  final DateTime? rejectedAt;
  final String? rejectionReason;

  DateTime? get sentAt => submittedAt ?? createdAt;

  @override
  List<Object?> get props =>
      [id, fullName, stage, approvalStatus, createdAt, unitCode, assignedSalesName, approvedAt, rejectedAt, rejectionReason];
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
  const BrokerLeadDetail({required this.lead, required this.timeline, this.unitCode, this.visits = const []});
  final BrokerLead lead;
  final List<BrokerLeadTimelineEntry> timeline;
  final String? unitCode;

  /// The visits booked with the lead, newest first.
  final List<BrokerLeadVisit> visits;

  @override
  List<Object?> get props => [lead, timeline, unitCode, visits];
}

class BrokerLeadVisit extends Equatable {
  const BrokerLeadVisit({required this.id, required this.status, this.number, this.at});
  final String id;
  final String status;
  final String? number;
  final DateTime? at;

  @override
  List<Object?> get props => [id, status, number, at];
}

/// How many of the broker's leads stand in each approval status.
class BrokerLeadCounts extends Equatable {
  const BrokerLeadCounts({this.total = 0, this.pending = 0, this.approved = 0, this.rejected = 0});
  final int total;
  final int pending;
  final int approved;
  final int rejected;

  @override
  List<Object?> get props => [total, pending, approved, rejected];
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
