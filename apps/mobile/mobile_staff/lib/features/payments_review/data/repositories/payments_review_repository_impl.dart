import 'package:core/core.dart';

import '../../domain/entities/payment_review_item.dart';
import '../../domain/repositories/payments_review_repository.dart';
import '../datasources/payments_review_remote_data_source.dart';
import '../mappers/payment_review_mapper.dart';

class PaymentsReviewRepositoryImpl implements PaymentsReviewRepository {
  PaymentsReviewRepositoryImpl(this._remote);
  final PaymentsReviewRemoteDataSource _remote;

  @override
  Future<Result<List<PaymentReviewItem>>> getReviewQueue() {
    return guardApiCall(() async {
      final rows = await _remote.reviewQueue();
      return rows.map((r) => r.toEntity()).toList();
    });
  }

  @override
  Future<Result<void>> approve(String depositId, {String? note}) {
    return guardApiCall(() => _remote.approve(depositId, note: note));
  }

  @override
  Future<Result<void>> reject(String depositId, {required String reason}) {
    return guardApiCall(() => _remote.reject(depositId, reason: reason));
  }
}
