import '../../domain/entities/visit.dart';
import '../dtos/visit_dtos.dart';

extension VisitDtoMapper on VisitDto {
  Visit toEntity() => Visit(
        id: id,
        status: status,
        visitNumber: visitNumber,
        scheduledAt: DateTime.tryParse(scheduledAt ?? ''),
        clientName: clientName,
        clientPhone: clientPhone,
        projectName: projectName,
        unitCode: unitCode,
        location: location,
        leadId: leadId,
        customerFeedback: customerFeedback,
        requestPreferredDate: DateTime.tryParse(requestPreferredDate ?? ''),
        requestPreferredTime: requestPreferredTime,
        requestNotes: requestNotes,
      );
}

extension VisitDetailDtoMapper on VisitDetailDto {
  VisitDetail toEntity() => VisitDetail(
        visit: visit.toEntity(),
        salesNotes: salesNotes,
        timeline: [
          for (final a in activities)
            VisitActivityEntry(
              id: a.id,
              type: a.type,
              note: a.note,
              actorName: a.actorName,
              createdAt: DateTime.tryParse(a.createdAt ?? ''),
            ),
        ].reversed.toList(), // newest first (API returns ascending)
      );
}
