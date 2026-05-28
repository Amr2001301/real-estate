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
      );
}

extension LeadDetailDtoMapper on LeadDetailDto {
  LeadDetail toEntity() {
    final entries = <LeadTimelineEntry>[
      for (final n in notes)
        LeadTimelineEntry(
          id: n.id,
          body: n.body,
          isNote: true,
          authorName: n.authorName,
          createdAt: DateTime.tryParse(n.createdAt ?? ''),
        ),
      for (final a in activities)
        LeadTimelineEntry(
          id: a.id,
          body: a.type,
          isNote: false,
          createdAt: DateTime.tryParse(a.createdAt ?? ''),
        ),
    ]..sort((a, b) {
        final at = a.createdAt, bt = b.createdAt;
        if (at == null && bt == null) return 0;
        if (at == null) return 1;
        if (bt == null) return -1;
        return bt.compareTo(at); // newest first
      });

    return LeadDetail(lead: lead.toEntity(), timeline: entries, unitInterest: unitInterest);
  }
}
