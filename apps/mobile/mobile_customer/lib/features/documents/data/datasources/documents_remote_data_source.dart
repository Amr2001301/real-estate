import 'package:dio/dio.dart';

import '../dtos/document_dtos.dart';

/// Raw network access to /me/documents (authenticated). May throw.
abstract interface class DocumentsRemoteDataSource {
  Future<List<CustomerDocumentDto>> listForOwner(String ownerType, String ownerId);
  Future<DocumentDownloadLinkDto> downloadLink(String documentId);
}

class DocumentsRemoteDataSourceImpl implements DocumentsRemoteDataSource {
  DocumentsRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<List<CustomerDocumentDto>> listForOwner(
      String ownerType, String ownerId) async {
    final res = await _dio.get<List<dynamic>>(
      '/me/documents',
      queryParameters: {'ownerType': ownerType, 'ownerId': ownerId},
    );
    return (res.data ?? [])
        .whereType<Map<String, dynamic>>()
        .map(CustomerDocumentDto.fromJson)
        .toList();
  }

  @override
  Future<DocumentDownloadLinkDto> downloadLink(String documentId) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/me/documents/$documentId/download',
    );
    return DocumentDownloadLinkDto.fromJson(res.data!);
  }
}
