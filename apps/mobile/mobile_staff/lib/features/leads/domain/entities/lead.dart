import 'package:core/core_domain.dart';

/// A sales lead (list projection). `stage` is the backend wire value
/// (NEW/INTERESTED/…) so the shared stage-label helper can render it.
class Lead extends Equatable {
  const Lead({
    required this.id,
    required this.fullName,
    required this.stage,
    this.phone,
    this.email,
    this.projectInterest,
    this.assignedSalesName,
    this.createdAt,
  });

  final String id;
  final String fullName;
  final String stage;
  final String? phone;
  final String? email;
  final String? projectInterest;
  final String? assignedSalesName;
  final DateTime? createdAt;

  @override
  List<Object?> get props => [id, fullName, stage, phone, createdAt];
}

/// One entry on a lead's timeline — a manual note or a system activity.
class LeadTimelineEntry extends Equatable {
  const LeadTimelineEntry({
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
  List<Object?> get props => [id, body, isNote, authorName, createdAt];
}

/// Full lead detail: the lead plus its merged timeline (notes + activities).
class LeadDetail extends Equatable {
  const LeadDetail({
    required this.lead,
    required this.timeline,
    this.unitInterest,
  });

  final Lead lead;
  final List<LeadTimelineEntry> timeline;
  final String? unitInterest;

  @override
  List<Object?> get props => [lead, timeline, unitInterest];
}
