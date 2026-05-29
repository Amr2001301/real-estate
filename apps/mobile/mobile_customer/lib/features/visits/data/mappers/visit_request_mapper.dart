import 'package:core/core_domain.dart';

import '../../domain/entities/visit_request.dart';
import '../dtos/visit_request_dto.dart';

extension AppointmentSummaryDtoMapper on AppointmentSummaryDto {
  AppointmentSummary toEntity() => AppointmentSummary(
        id: id,
        status: AppointmentStatus.fromWire(statusWire),
        scheduledAt: DateTime.tryParse(scheduledAt ?? ''),
        durationMinutes: durationMinutes,
        location: location,
        meetingPoint: meetingPoint,
        customerFeedback: customerFeedback,
      );
}

extension VisitRequestDtoMapper on VisitRequestDto {
  VisitRequest toEntity() {
    final hasName = (projectNameAr?.isNotEmpty ?? false) ||
        (projectNameEn?.isNotEmpty ?? false);
    // P2 backend writes `requestNotes`; pre-P2 rows only have `notes`. Fall
    // back to whichever is present so the card always renders the customer
    // message.
    final message = (requestNotes?.isNotEmpty ?? false) ? requestNotes : notes;
    return VisitRequest(
      id: id,
      projectId: projectId,
      unitId: unitId,
      status: VisitStatus.fromWire(statusWire),
      projectName: hasName
          ? Translatable(ar: projectNameAr ?? '', en: projectNameEn ?? '')
          : null,
      preferredDate: DateTime.tryParse(preferredDate ?? ''),
      preferredTime: preferredTime,
      notes: message,
      scheduledAt: DateTime.tryParse(scheduledAt ?? ''),
      createdAt: DateTime.tryParse(createdAt ?? ''),
      assignedSalesName: assignedSalesName,
      appointments: appointments.map((dto) => dto.toEntity()).toList(growable: false),
    );
  }
}
