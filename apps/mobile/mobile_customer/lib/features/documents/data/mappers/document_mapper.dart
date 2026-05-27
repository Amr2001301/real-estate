import '../../domain/entities/customer_document.dart';
import '../dtos/document_dtos.dart';

extension CustomerDocumentDtoMapper on CustomerDocumentDto {
  CustomerDocument toEntity() => CustomerDocument(
        id: id,
        title: title,
        fileName: fileName,
        mimeType: mimeType,
        category: category,
        createdAt: DateTime.tryParse(createdAt ?? ''),
      );
}

extension DocumentDownloadLinkDtoMapper on DocumentDownloadLinkDto {
  DocumentDownloadLink toEntity() => DocumentDownloadLink(
        url: url,
        fileName: fileName,
        contentType: contentType,
        expiresIn: expiresIn,
      );
}
