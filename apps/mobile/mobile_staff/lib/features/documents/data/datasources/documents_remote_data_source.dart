import 'package:dio/dio.dart';

import '../dtos/staff_document_dto.dart';

abstract interface class StaffDocumentsRemoteDataSource {
  Future<List<StaffDocumentDto>> listDocuments({
    required String ownerType,
    required String ownerId,
  });
  Future<StaffDocumentDownloadDto> getDownloadUrl(String documentId);
}

class StaffDocumentsRemoteDataSourceImpl implements StaffDocumentsRemoteDataSource {
  StaffDocumentsRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<List<StaffDocumentDto>> listDocuments({
    required String ownerType,
    required String ownerId,
  }) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/documents',
      queryParameters: {'ownerType': ownerType, 'ownerId': ownerId, 'pageSize': 50},
    );
    final data = (res.data?['data'] as List?) ?? const [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(StaffDocumentDto.fromJson)
        .toList();
  }

  @override
  Future<StaffDocumentDownloadDto> getDownloadUrl(String documentId) async {
    final res = await _dio.get<Map<String, dynamic>>('/documents/$documentId/download');
    return StaffDocumentDownloadDto.fromJson(res.data!);
  }
}
