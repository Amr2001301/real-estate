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
    this.nextActionAt,
    this.nextActionType,
    this.nextActionNote,
  });

  final String id;
  final String fullName;
  final String stage;
  final String? phone;
  final String? email;
  final String? projectInterest;
  final String? assignedSalesName;
  final DateTime? createdAt;

  /// FU1 — the next follow-up: when, what (CALL/MEETING/WHATSAPP/FOLLOW_UP)
  /// and a word on it. Null when none is set.
  final DateTime? nextActionAt;
  final String? nextActionType;
  final String? nextActionNote;

  @override
  List<Object?> get props => [id, fullName, stage, phone, createdAt, nextActionAt, nextActionType, nextActionNote];
}

/// One entry on a lead's timeline — a logged activity (note, call, meeting,
/// WhatsApp, follow-up) or a system activity.
class LeadTimelineEntry extends Equatable {
  const LeadTimelineEntry({
    required this.id,
    required this.body,
    required this.isNote,
    this.authorName,
    this.createdAt,
    this.kind = 'NOTE',
    this.callResult,
    this.nextActionAt,
    this.replies = const [],
  });

  final String id;
  final String body;
  final bool isNote;
  final String? authorName;
  final DateTime? createdAt;

  /// FU1 — what the logged activity was (notes only): NOTE, CALL, MEETING,
  /// WHATSAPP or FOLLOW_UP; how a call went; the follow-up it set.
  final String kind;
  final String? callResult;
  final DateTime? nextActionAt;

  /// Replies to this note, oldest first (notes only, one level).
  final List<LeadTimelineEntry> replies;

  @override
  List<Object?> get props => [id, body, isNote, authorName, createdAt, kind, callResult, nextActionAt, replies];
}

/// Full lead detail: the lead plus its merged timeline (notes + activities).
class LeadDetail extends Equatable {
  const LeadDetail({
    required this.lead,
    required this.timeline,
    this.unitInterest,
    this.lostReason,
    this.lostNote,
  });

  final Lead lead;
  final List<LeadTimelineEntry> timeline;
  final String? unitInterest;

  /// LR1 — why a lost lead was lost (null otherwise, or before reasons existed).
  final Translatable? lostReason;
  final String? lostNote;

  @override
  List<Object?> get props => [lead, timeline, unitInterest, lostReason, lostNote];
}

/// LR1 — one of the company's reasons a lead is lost.
class LostReason extends Equatable {
  const LostReason({required this.id, required this.name});
  final String id;
  final Translatable name;

  @override
  List<Object?> get props => [id, name];
}

/// FU1 — the three follow-up lists: due before now, later today, after today.
enum FollowUpBucket {
  overdue,
  today,
  upcoming;

  String get wire => name;
}

/// FU1 — how many leads wait in each follow-up list.
class FollowUpSummary extends Equatable {
  const FollowUpSummary({this.overdue = 0, this.today = 0, this.upcoming = 0});
  final int overdue;
  final int today;
  final int upcoming;

  int of(FollowUpBucket b) => switch (b) {
        FollowUpBucket.overdue => overdue,
        FollowUpBucket.today => today,
        FollowUpBucket.upcoming => upcoming,
      };

  @override
  List<Object?> get props => [overdue, today, upcoming];
}

/// FU1 — a lead in a follow-up list, with its latest logged activity.
class FollowUp extends Equatable {
  const FollowUp({
    required this.lead,
    this.lastKind,
    this.lastCallResult,
    this.lastBody,
    this.lastAt,
  });

  final Lead lead;
  final String? lastKind;
  final String? lastCallResult;
  final String? lastBody;
  final DateTime? lastAt;

  @override
  List<Object?> get props => [lead, lastKind, lastCallResult, lastBody, lastAt];
}

/// FU1 — what logging an activity does to the lead's next follow-up.
enum NextActionChange { keep, clear, set }

/// FU1 — an activity to log on a lead: what happened, how a call went, and
/// the next follow-up. A reply ([parentId]) is text only.
class LeadNoteInput extends Equatable {
  const LeadNoteInput({
    required this.body,
    this.kind = 'NOTE',
    this.callResult,
    this.parentId,
    this.nextChange = NextActionChange.keep,
    this.nextActionAt,
    this.nextActionType,
    this.nextActionNote,
  });

  const LeadNoteInput.reply({required String parentId, required String body})
      : this(body: body, parentId: parentId);

  final String body;
  final String kind;
  final String? callResult;
  final String? parentId;
  final NextActionChange nextChange;
  final DateTime? nextActionAt;
  final String? nextActionType;
  final String? nextActionNote;

  /// The request body for POST /leads/:id/notes. A reply sends its text only;
  /// a kept follow-up leaves `nextActionAt` out, a cleared one sends null.
  Map<String, dynamic> toJson() {
    if (parentId != null) return {'body': body, 'parentId': parentId};
    final note = nextActionNote?.trim();
    return {
      'body': body,
      'kind': kind,
      if (kind == 'CALL' && callResult != null) 'callResult': callResult,
      if (nextChange == NextActionChange.clear) 'nextActionAt': null,
      if (nextChange == NextActionChange.set && nextActionAt != null) ...{
        'nextActionAt': nextActionAt!.toUtc().toIso8601String(),
        'nextActionType': ?nextActionType,
        if (note != null && note.isNotEmpty) 'nextActionNote': note,
      },
    };
  }

  @override
  List<Object?> get props =>
      [body, kind, callResult, parentId, nextChange, nextActionAt, nextActionType, nextActionNote];
}
