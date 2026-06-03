import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../dtos/maintenance_dtos.dart';
import '../dtos/maintenance_upload_dtos.dart';

abstract interface class MaintenanceRemoteDataSource {
  Future<List<MaintenanceCategoryDto>> listCategories();
  Future<List<MaintenanceRequestDto>> listMyRequests();
  Future<MaintenanceRequestDto> createRequest({
    required String unitId,
    required List<String> categoryIds,
    required String description,
  });

  /// Mints a short-lived signed PUT URL for a photo on [requestId].
  Future<PresignResponseDto> presignPhoto({
    required String requestId,
    required String contentType,
    required int sizeBytes,
    required String fileName,
  });

  /// Uploads raw bytes to the signed [uploadUrl]. Uses a bare HTTP client so
  /// the app's bearer token is never sent to object storage.
  Future<void> putToSignedUrl({
    required String uploadUrl,
    required Uint8List bytes,
    required String contentType,
    void Function(double progress)? onProgress,
  });

  /// Registers the uploaded object as a customer-visible document on [requestId].
  Future<void> registerPhoto({
    required String requestId,
    required String fileUrl,
    required String title,
    required String fileName,
    required String mimeType,
    required int sizeBytes,
  });

  /// Phase A — customer confirms resolution with a 1–5 rating + optional note.
  /// Returns the updated request.
  Future<MaintenanceRequestDto> confirmResolution({
    required String requestId,
    required int rating,
    String? note,
  });

  /// Phase A — customer files a complaint on an overdue request. Returns the
  /// updated request.
  Future<MaintenanceRequestDto> submitComplaint({required String requestId});
}

class MaintenanceRemoteDataSourceImpl implements MaintenanceRemoteDataSource {
  MaintenanceRemoteDataSourceImpl(this._dio, {Dio? uploadClient})
      : _uploadClient = uploadClient ?? Dio();

  final Dio _dio;

  /// Separate, interceptor-free client for the direct-to-storage PUT, so no
  /// Authorization header (bearer token) leaks to the object store.
  final Dio _uploadClient;

  @override
  Future<List<MaintenanceCategoryDto>> listCategories() async {
    final res = await _dio.get<List<dynamic>>('/maintenance-categories');
    final data = res.data ?? const [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(MaintenanceCategoryDto.fromJson)
        .toList();
  }

  @override
  Future<List<MaintenanceRequestDto>> listMyRequests() async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/me/maintenance-requests',
      queryParameters: {'page': 1, 'pageSize': 100},
    );
    final data = (res.data?['data'] as List?) ?? const [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(MaintenanceRequestDto.fromJson)
        .toList();
  }

  @override
  Future<MaintenanceRequestDto> createRequest({
    required String unitId,
    required List<String> categoryIds,
    required String description,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/me/maintenance-requests',
      data: {
        'unitId': unitId,
        'categoryIds': categoryIds,
        'description': description,
      },
    );
    return MaintenanceRequestDto.fromJson(res.data ?? const {});
  }

  @override
  Future<PresignResponseDto> presignPhoto({
    required String requestId,
    required String contentType,
    required int sizeBytes,
    required String fileName,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/me/maintenance-requests/$requestId/documents/presign',
      data: {
        'contentType': contentType,
        'sizeBytes': sizeBytes,
        'fileName': fileName,
      },
    );
    return PresignResponseDto.fromJson(res.data ?? const {});
  }

  @override
  Future<void> putToSignedUrl({
    required String uploadUrl,
    required Uint8List bytes,
    required String contentType,
    void Function(double progress)? onProgress,
  }) async {
    try {
      await _uploadClient.put<void>(
        uploadUrl,
        data: Stream<List<int>>.fromIterable([bytes]),
        options: Options(
          headers: {
            Headers.contentTypeHeader: contentType,
            Headers.contentLengthHeader: bytes.length,
          },
        ),
        onSendProgress: onProgress == null
            ? null
            : (sent, total) {
                if (total > 0) onProgress(sent / total);
              },
      );
    } on DioException catch (e) {
      // Re-throw with the signed URL redacted so it can never reach an
      // AppFailure's technicalMessage / log line. The failure TYPE is preserved
      // (a redacted RequestOptions path) so error mapping stays accurate.
      throw DioException(
        requestOptions: RequestOptions(path: '[r2-upload]'),
        type: e.type,
        response: e.response == null
            ? null
            : Response(
                requestOptions: RequestOptions(path: '[r2-upload]'),
                statusCode: e.response!.statusCode,
              ),
      );
    }
  }

  @override
  Future<void> registerPhoto({
    required String requestId,
    required String fileUrl,
    required String title,
    required String fileName,
    required String mimeType,
    required int sizeBytes,
  }) async {
    await _dio.post<Map<String, dynamic>>(
      '/me/maintenance-requests/$requestId/documents',
      data: {
        'title': title,
        'fileUrl': fileUrl,
        'fileName': fileName,
        'mimeType': mimeType,
        'sizeBytes': sizeBytes,
      },
    );
  }

  @override
  Future<MaintenanceRequestDto> confirmResolution({
    required String requestId,
    required int rating,
    String? note,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/me/maintenance-requests/$requestId/confirm-resolution',
      data: {
        'rating': rating,
        if (note != null && note.isNotEmpty) 'note': note,
      },
    );
    return MaintenanceRequestDto.fromJson(res.data ?? const {});
  }

  @override
  Future<MaintenanceRequestDto> submitComplaint({required String requestId}) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/me/maintenance-requests/$requestId/complaint',
    );
    return MaintenanceRequestDto.fromJson(res.data ?? const {});
  }
}
