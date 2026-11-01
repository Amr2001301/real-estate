import '../../domain/entities/lead.dart';
import '../dtos/lead_dtos.dart';

extension LeadRowDtoMapper on LeadRowDto {
  Lead toEntity() => Lead(
        id: id,
        fullName: fullName,
        stage: stage,
        phone: phone,
        email: email,
        projectInterest: projectInterest,
        assignedSalesName: assignedSalesName,
        createdAt: DateTime.tryParse(createdAt ?? ''),
        nextActionAt: DateTime.tryParse(nextActionAt ?? '')?.toLocal(),
        nextActionType: nextActionType,
        nextActionNote: nextActionNote,
      );
}

extension LeadNoteDtoMapper on LeadNoteDto {
  LeadTimelineEntry toEntry() => LeadTimelineEntry(
        id: id,
        body: body,
        isNote: true,
        authorName: authorName,
        // Shown as a time of day: the phone's time, not UTC.
        createdAt: DateTime.tryParse(createdAt ?? '')?.toLocal(),
        kind: kind,
        callResult: callResult,
        nextActionAt: DateTime.tryParse(nextActionAt ?? '')?.toLocal(),
        replies: [for (final r in replies) r.toEntry()],
      );
}

extension FollowUpRowDtoMapper on FollowUpRowDto {
  FollowUp toEntity() {
    final last = lastActivity;
    return FollowUp(
      lead: lead.toEntity(),
      lastKind: last?['kind'] as String?,
      lastCallResult: last?['callResult'] as String?,
      lastBody: last?['body'] as String?,
      lastAt: DateTime.tryParse(last?['createdAt'] as String? ?? '')?.toLocal(),
    );
  }
}

extension LeadDetailDtoMapper on LeadDetailDto {
  LeadDetail toEntity() {
    final entries = <LeadTimelineEntry>[
      for (final n in notes) n.toEntry(),
      for (final a in activities)
        LeadTimelineEntry(
          id: a.id,
          body: a.type,
          isNote: false,
          createdAt: DateTime.tryParse(a.createdAt ?? '')?.toLocal(),
        ),
    ]..sort((a, b) {
        final at = a.createdAt, bt = b.createdAt;
        if (at == null && bt == null) return 0;
        if (at == null) return 1;
        if (bt == null) return -1;
        return bt.compareTo(at); // newest first
      });

    return LeadDetail(
      lead: lead.toEntity(),
      timeline: entries,
      unitInterest: unitInterest,
      lostReason: lostReason,
      lostNote: lostNote,
    );
  }
}
