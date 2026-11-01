import 'package:core/core_domain.dart';
import 'package:dio/dio.dart';

import '../../domain/repositories/leads_repository.dart' show OpenLeadRef;

// Wire shapes for the leads endpoints. Data layer only.

class ClientSearchDto {
  const ClientSearchDto({
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

  factory ClientSearchDto.fromJson(Map<String, dynamic> json) => ClientSearchDto(
        id: json['id'] as String,
        fullName: json['fullName'] as String? ?? '',
        phone: json['phone'] as String?,
        email: json['email'] as String?,
        role: json['role'] as String? ?? 'CLIENT',
      );
}

class LeadSourceDto {
  const LeadSourceDto({required this.id, required this.name});
  final String id;
  final String name;

  factory LeadSourceDto.fromJson(Map<String, dynamic> json) => LeadSourceDto(
        id: json['id'] as String,
        name: json['name'] as String? ?? '',
      );
}

class LeadRowDto {
  const LeadRowDto({
    required this.id,
    required this.fullName,
    required this.stage,
    this.phone,
    this.email,
    this.projectInterest,
    this.assignedSalesName,
    this.createdAt,
    this.nextActionAt,
    this.nextActionType,
    this.nextActionNote,
    this.campaignName,
    this.campaignChannel,
  });

  final String id;
  final String fullName;
  final String stage;
  final String? phone;
  final String? email;
  final String? projectInterest;
  final String? assignedSalesName;
  final String? createdAt;
  final String? nextActionAt;
  final String? nextActionType;
  final String? nextActionNote;
  final String? campaignName;
  final String? campaignChannel;

  factory LeadRowDto.fromJson(Map<String, dynamic> json) {
    final client = json['client'] as Map<String, dynamic>?;
    final assigned = json['assignedSales'] as Map<String, dynamic>?;
    final project = json['projectInterest'] as Map<String, dynamic>?;
    final projectName = project?['name'];
    final campaign = json['campaign'] as Map<String, dynamic>?;
    return LeadRowDto(
      id: json['id'] as String,
      // Prefer the linked client's canonical contact; fall back to the row cache.
      fullName: (client?['fullName'] as String?) ?? json['fullName'] as String? ?? '',
      phone: (client?['phone'] as String?) ?? json['phone'] as String?,
      email: (client?['email'] as String?) ?? json['email'] as String?,
      stage: json['stage'] as String? ?? 'NEW',
      projectInterest: projectName is Map ? projectName['en'] as String? : projectName as String?,
      assignedSalesName: assigned?['fullName'] as String?,
      createdAt: json['createdAt'] as String?,
      nextActionAt: json['nextActionAt'] as String?,
      nextActionType: json['nextActionType'] as String?,
      nextActionNote: json['nextActionNote'] as String?,
      campaignName: campaign?['name'] as String?,
      campaignChannel: campaign?['channel'] as String?,
    );
  }
}

class LeadNoteDto {
  const LeadNoteDto({
    required this.id,
    required this.body,
    this.authorName,
    this.createdAt,
    this.kind = 'NOTE',
    this.callResult,
    this.nextActionAt,
    this.replies = const [],
  });
  final String id;
  final String body;
  final String? authorName;
  final String? createdAt;
  final String kind;
  final String? callResult;
  final String? nextActionAt;
  final List<LeadNoteDto> replies;

  factory LeadNoteDto.fromJson(Map<String, dynamic> json) => LeadNoteDto(
        id: json['id'] as String,
        body: json['body'] as String? ?? '',
        authorName: (json['sales'] as Map<String, dynamic>?)?['fullName'] as String?,
        createdAt: json['createdAt'] as String?,
        kind: json['kind'] as String? ?? 'NOTE',
        callResult: json['callResult'] as String?,
        nextActionAt: json['nextActionAt'] as String?,
        replies: ((json['replies'] as List?) ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(LeadNoteDto.fromJson)
            .toList(),
      );
}

/// FU1 — a row of GET /leads/follow-ups: the lead and its latest activity.
class FollowUpRowDto {
  const FollowUpRowDto({required this.lead, this.lastActivity});
  final LeadRowDto lead;
  final Map<String, dynamic>? lastActivity;

  factory FollowUpRowDto.fromJson(Map<String, dynamic> json) => FollowUpRowDto(
        lead: LeadRowDto.fromJson(json),
        lastActivity: json['lastActivity'] as Map<String, dynamic>?,
      );
}

/// FU1 — GET /leads/follow-ups/summary.
class FollowUpSummaryDto {
  const FollowUpSummaryDto({this.overdue = 0, this.today = 0, this.upcoming = 0});
  final int overdue;
  final int today;
  final int upcoming;

  factory FollowUpSummaryDto.fromJson(Map<String, dynamic> json) => FollowUpSummaryDto(
        overdue: (json['overdue'] as num?)?.toInt() ?? 0,
        today: (json['today'] as num?)?.toInt() ?? 0,
        upcoming: (json['upcoming'] as num?)?.toInt() ?? 0,
      );
}

class LeadActivityDto {
  const LeadActivityDto({required this.id, required this.type, this.createdAt});
  final String id;
  final String type;
  final String? createdAt;

  factory LeadActivityDto.fromJson(Map<String, dynamic> json) => LeadActivityDto(
        id: json['id'] as String,
        type: json['type'] as String? ?? 'activity',
        createdAt: json['createdAt'] as String?,
      );
}

class LeadDetailDto {
  const LeadDetailDto({
    required this.lead,
    required this.notes,
    required this.activities,
    this.unitInterest,
    this.lostReason,
    this.lostNote,
  });

  final LeadRowDto lead;
  final List<LeadNoteDto> notes;
  final List<LeadActivityDto> activities;
  final String? unitInterest;

  /// LR1 — why a lost lead was lost.
  final Translatable? lostReason;
  final String? lostNote;

  factory LeadDetailDto.fromJson(Map<String, dynamic> json) {
    final unit = json['unitInterest'] as Map<String, dynamic>?;
    final lost = json['lostReason'] as Map<String, dynamic>?;
    return LeadDetailDto(
      lead: LeadRowDto.fromJson(json),
      unitInterest: unit?['code'] as String?,
      lostReason: lost == null ? null : Translatable.fromJson(lost['name']),
      lostNote: json['lostNote'] as String?,
      notes: ((json['notes'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(LeadNoteDto.fromJson)
          .toList(),
      activities: ((json['activities'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(LeadActivityDto.fromJson)
          .toList(),
    );
  }
}

/// LR1 — one of the company's reasons a lead is lost. The name comes
/// flattened to the request language, or as `{ar, en}`.
class LostReasonDto {
  const LostReasonDto({required this.id, required this.name});
  final String id;
  final Translatable name;

  factory LostReasonDto.fromJson(Map<String, dynamic> json) => LostReasonDto(
        id: json['id'] as String,
        name: Translatable.fromJson(json['name']),
      );
}

/// DUP2 — the open leads named by a 409 OPEN_LEAD_EXISTS refusal (empty for
/// any other failure).
List<OpenLeadRef> openLeadsOf(AppFailure failure) {
  if (failure.code != 'OPEN_LEAD_EXISTS') return const [];
  final err = failure.originalError;
  final data = err is DioException ? err.response?.data : null;
  final leads = data is Map ? data['leads'] : null;
  if (leads is! List) return const [];
  return [
    for (final l in leads.whereType<Map>())
      OpenLeadRef(
        id: l['id'] as String? ?? '',
        stage: l['stage'] as String? ?? 'NEW',
        ownerName: (l['assignedSales'] as Map?)?['fullName'] as String?,
        createdAt: DateTime.tryParse(l['createdAt'] as String? ?? '')?.toLocal(),
      ),
  ];
}
