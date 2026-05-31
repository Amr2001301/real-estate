import 'package:core/core_domain.dart';

import '../entities/payment_review_item.dart';

/// Staff/admin payment-proof review surface. Backed by the existing deposit
/// review endpoints. Every method returns a [Result] carrying an [AppFailure]
/// on the error arm — the UI never sees a raw backend error.
abstract interface class PaymentsReviewRepository {
  /// Pending customer payment proofs (`GET /deposits/review-queue`).
  Future<Result<List<PaymentReviewItem>>> getReviewQueue();

  /// Approve a submitted proof (`POST /deposits/:id/approve`). ADMIN + strict
  /// `deposits:verify` on the backend; a 403 surfaces as a forbidden failure.
  Future<Result<void>> approve(String depositId, {String? note});

  /// Reject a submitted proof with a required reason
  /// (`POST /deposits/:id/reject`). ADMIN + strict `deposits:verify`.
  Future<Result<void>> reject(String depositId, {required String reason});
}
