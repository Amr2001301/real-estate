import '../../domain/entities/staff_document.dart';
import '../dtos/staff_document_dto.dart';

extension StaffDocumentDtoMapper on StaffDocumentDto {
  StaffDocument toEntity() => StaffDocument(
        id: id,
        title: title,
        fileName: fileName,
        mimeType: mimeType,
        category: category,
        createdAt: createdAt != null ? DateTime.tryParse(createdAt!) : null,
      );
}
