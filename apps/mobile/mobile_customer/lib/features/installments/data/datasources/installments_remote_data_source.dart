import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../dtos/installment_dto.dart';
import '../dtos/presign_response_dto.dart';
import '../dtos/proof_deposit_dto.dart';

abstract interface class InstallmentsRemoteDataSource {
  Future<List<InstallmentDto>> listMyInstallments();

  /// Read the customer's deposits so we can enrich each installment with
  /// the latest proof status (PENDING_REVIEW / APPROVED / REJECTED). The
  /// backend doesn't (yet) embed proof state inside the installment row,
  /// so the repository merges the two streams.
  Future<List<ProofDepositDto>> listMyDeposits();

  /// Mints a short-lived signed PUT URL for a payment-proof upload.
  Future<PresignResponseDto> presign({
    required String contentType,
    required int sizeBytes,
    required String fileName,
  });

  /// PUTs raw bytes to [uploadUrl]. Uses an interceptor-free Dio so the
  /// app's bearer token is NEVER attached to the object-store request.
  Future<void> putToSignedUrl({
    required String uploadUrl,
    required Uint8List bytes,
    required String contentType,
    void Function(double progress)? onProgress,
  });

  /// First submission against a still-unpaid installment. Backend creates
  /// the Deposit in PENDING_REVIEW and registers the Document.
  Future<SubmittedProofDto> submitProof({
    required String installmentId,
    required num amount,
    required String paidAtIso,
    required String paymentMethod,
    required String receiptUrl,
    String? fileName,
    String? mimeType,
    int? sizeBytes,
    String? note,
  });

  /// Resubmits proof for a previously REJECTED deposit. Backend resets
  /// reviewStatus to PENDING_REVIEW and clears the rejection reason.
  Future<SubmittedProofDto> resubmitProof({
    required String depositId,
    required String paymentMethod,
    required String receiptUrl,
    String? fileName,
    String? mimeType,
    int? sizeBytes,
    String? paidAtIso,
    String? note,
  });
}

class InstallmentsRemoteDataSourceImpl implements InstallmentsRemoteDataSource {
  InstallmentsRemoteDataSourceImpl(this._dio, {Dio? uploadClient})
      : _uploadClient = uploadClient ?? Dio();

  final Dio _dio;

  /// Separate, interceptor-free client for the direct-to-storage PUT, so
  /// the bearer token is never sent to the object store. CRITICAL — this
  /// must never be replaced with the shared [_dio] instance. Tested in
  /// `submit_proof_no_auth_on_put_test.dart`.
  final Dio _uploadClient;

  @override
  Future<List<InstallmentDto>> listMyInstallments() async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/me/installments',
      queryParameters: {'page': 1, 'pageSize': 100},
    );
    final data = (res.data?['data'] as List?) ?? const [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(InstallmentDto.fromJson)
        .toList();
  }

  @override
  Future<List<ProofDepositDto>> listMyDeposits() async {
    final res = await _dio.get<Map<String, dynamic>>('/me/deposits');
    final data = (res.data?['data'] as List?) ?? const [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(ProofDepositDto.fromJson)
        .toList();
  }

  @override
  Future<PresignResponseDto> presign({
    required String contentType,
    required int sizeBytes,
    required String fileName,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/me/payments/presign',
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
      // Redact the signed URL from the rethrown exception so it can never
      // reach AppLog / an AppFailure's technicalMessage. The failure TYPE
      // is preserved so the repository's guardApiCall maps it accurately.
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
  Future<SubmittedProofDto> submitProof({
    required String installmentId,
    required num amount,
    required String paidAtIso,
    required String paymentMethod,
    required String receiptUrl,
    String? fileName,
    String? mimeType,
    int? sizeBytes,
    String? note,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/me/deposits',
      data: {
        'installmentId': installmentId,
        'amount': amount,
        'paidAt': paidAtIso,
        'paymentMethod': paymentMethod,
        'receiptUrl': receiptUrl,
        'fileName': ?fileName,
        'mimeType': ?mimeType,
        'sizeBytes': ?sizeBytes,
        if (note != null && note.isNotEmpty) 'note': note,
      },
    );
    return SubmittedProofDto.fromJson(res.data ?? const {});
  }

  @override
  Future<SubmittedProofDto> resubmitProof({
    required String depositId,
    required String paymentMethod,
    required String receiptUrl,
    String? fileName,
    String? mimeType,
    int? sizeBytes,
    String? paidAtIso,
    String? note,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/me/deposits/$depositId/resubmit',
      data: {
        'paymentMethod': paymentMethod,
        'receiptUrl': receiptUrl,
        'fileName': ?fileName,
        'mimeType': ?mimeType,
        'sizeBytes': ?sizeBytes,
        'paidAt': ?paidAtIso,
        if (note != null && note.isNotEmpty) 'note': note,
      },
    );
    return SubmittedProofDto.fromJson(res.data ?? const {});
  }
}
