import 'package:core/core_domain.dart';

/// A scheduled visit appointment (list projection). `status` is the wire value
/// (SCHEDULED/CONFIRMED/COMPLETED/CANCELLED/NO_SHOW/RESCHEDULED).
class Visit extends Equatable {
  const Visit({
    required this.id,
    required this.status,
    this.visitNumber,
    this.scheduledAt,
    this.clientName,
    this.clientPhone,
    this.projectName,
    this.unitCode,
    this.location,
    this.leadId,
  });

  final String id;
  final String status;
  final String? visitNumber;
  final DateTime? scheduledAt;
  final String? clientName;
  final String? clientPhone;
  final String? projectName;
  final String? unitCode;
  final String? location;
  final String? leadId;

  @override
  List<Object?> get props => [id, status, visitNumber, scheduledAt, clientName];
}

/// One entry on a visit's activity timeline.
class VisitActivityEntry extends Equatable {
  const VisitActivityEntry({
    required this.id,
    required this.type,
    this.note,
    this.actorName,
    this.createdAt,
  });

  final String id;
  final String type;
  final String? note;
  final String? actorName;
  final DateTime? createdAt;

  @override
  List<Object?> get props => [id, type, note, createdAt];
}

/// Full visit detail: the visit + its salesNotes + activity timeline.
class VisitDetail extends Equatable {
  const VisitDetail({required this.visit, required this.timeline, this.salesNotes});

  final Visit visit;
  final List<VisitActivityEntry> timeline;
  final String? salesNotes;

  @override
  List<Object?> get props => [visit, timeline, salesNotes];
}

/// A status transition a sales rep can apply to a visit.
enum VisitTransition { confirm, complete, cancel, noShow }

/// Input for creating a visit appointment. `projectId` is required by the API.
class NewVisit {
  const NewVisit({
    required this.projectId,
    required this.scheduledAt,
    this.unitId,
    this.leadId,
    this.clientId,
    this.location,
    this.salesNotes,
  });

  final String projectId;
  final DateTime scheduledAt;
  final String? unitId;
  final String? leadId;
  final String? clientId;
  final String? location;
  final String? salesNotes;
}
