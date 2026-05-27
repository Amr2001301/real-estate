import 'package:core/core_domain.dart';

import '../../domain/entities/visit_request.dart';
import '../dtos/visit_request_dto.dart';

extension VisitRequestDtoMapper on VisitRequestDto {
  VisitRequest toEntity() {
    final hasName = (projectNameAr?.isNotEmpty ?? false) ||
        (projectNameEn?.isNotEmpty ?? false);
    return VisitRequest(
      id: id,
      projectId: projectId,
      unitId: unitId,
      status: VisitStatus.fromWire(statusWire),
      projectName: hasName
          ? Translatable(ar: projectNameAr ?? '', en: projectNameEn ?? '')
          : null,
      preferredDate: DateTime.tryParse(preferredDate ?? ''),
      notes: notes,
      createdAt: DateTime.tryParse(createdAt ?? ''),
    );
  }
}
