import 'package:core/core.dart';
import 'package:dio/dio.dart';

import '../domain/signature_request.dart';

class SignatureRequestsRepositoryImpl implements SignatureRequestsRepository {
  SignatureRequestsRepositoryImpl(this._dio);
  final Dio _dio;

  @override
  Future<Result<List<SignatureRequest>>> list(String reservationId) {
    return guardApiCall(() async {
      final res = await _dio.get<List<dynamic>>('/reservations/$reservationId/signature-requests');
      return (res.data ?? const []).whereType<Map<String, dynamic>>().map(SignatureRequest.fromJson).toList();
    });
  }

  @override
  Future<Result<SentSignatureRequest>> send(String reservationId, {required String locale}) {
    return guardApiCall(() async {
      final res = await _dio.post<Map<String, dynamic>>(
        '/reservations/$reservationId/signature-requests',
        data: {'locale': locale == 'en' ? 'en' : 'ar'},
      );
      final body = res.data ?? const {};
      return SentSignatureRequest(request: SignatureRequest.fromJson(body), url: body['url'] as String? ?? '');
    });
  }

  @override
  Future<Result<void>> cancel(String requestId) {
    return guardApiCall(() async {
      await _dio.delete<void>('/signature-requests/$requestId');
    });
  }
}
