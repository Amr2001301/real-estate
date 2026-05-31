import 'package:dio/dio.dart';

import '../dtos/payment_review_dto.dart';

/// Thin HTTP boundary for the staff payment-review endpoints. The shared `Dio`
/// attaches the bearer token automatically (AuthInterceptor). Data layer only.
abstract interface class PaymentsReviewRemoteDataSource {
  Future<List<PaymentReviewDto>> reviewQueue();
  Future<void> approve(String depositId, {String? note});
  Future<void> reject(String depositId, {required String reason});
}

class PaymentsReviewRemoteDataSourceImpl implements PaymentsReviewRemoteDataSource {
  PaymentsReviewRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<List<PaymentReviewDto>> reviewQueue() async {
    // Single page — mirrors the staff app's existing list convention. The
    // backend defaults reviewStatus to PENDING_REVIEW for this route.
    final res = await _dio.get<Map<String, dynamic>>(
      '/deposits/review-queue',
      queryParameters: const {'page': 1, 'pageSize': 50},
    );
    return PaymentReviewDto.listFromEnvelope(res.data);
  }

  @override
  Future<void> approve(String depositId, {String? note}) async {
    await _dio.post<Map<String, dynamic>>(
      '/deposits/$depositId/approve',
      data: {'note': ?note},
    );
  }

  @override
  Future<void> reject(String depositId, {required String reason}) async {
    await _dio.post<Map<String, dynamic>>(
      '/deposits/$depositId/reject',
      data: {'reason': reason},
    );
  }
}
