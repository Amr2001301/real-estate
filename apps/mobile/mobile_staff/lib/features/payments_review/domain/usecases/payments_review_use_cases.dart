import 'package:core/core_domain.dart';

import '../entities/payment_review_item.dart';
import '../repositories/payments_review_repository.dart';

/// Load the pending payment-proof review queue.
class GetPaymentReviewQueue implements UseCase<List<PaymentReviewItem>, NoParams> {
  const GetPaymentReviewQueue(this._repo);
  final PaymentsReviewRepository _repo;

  @override
  Future<Result<List<PaymentReviewItem>>> call(NoParams params) => _repo.getReviewQueue();
}

/// Input for approving a payment proof. `note` is optional (logged server-side).
class ApprovePaymentParams {
  const ApprovePaymentParams({required this.depositId, this.note});
  final String depositId;
  final String? note;
}

class ApprovePayment implements UseCase<void, ApprovePaymentParams> {
  const ApprovePayment(this._repo);
  final PaymentsReviewRepository _repo;

  @override
  Future<Result<void>> call(ApprovePaymentParams params) =>
      _repo.approve(params.depositId, note: params.note);
}

/// Input for rejecting a payment proof. `reason` is REQUIRED by the backend
/// (max 2000 chars) — the UI validates non-empty before calling.
class RejectPaymentParams {
  const RejectPaymentParams({required this.depositId, required this.reason});
  final String depositId;
  final String reason;
}

class RejectPayment implements UseCase<void, RejectPaymentParams> {
  const RejectPayment(this._repo);
  final PaymentsReviewRepository _repo;

  @override
  Future<Result<void>> call(RejectPaymentParams params) =>
      _repo.reject(params.depositId, reason: params.reason);
}

/// Resolve a fresh short-lived signed link to open a deposit's payment proof.
/// `In` is the deposit id.
class GetProofDownloadLink implements UseCase<ProofDownloadLink, String> {
  const GetProofDownloadLink(this._repo);
  final PaymentsReviewRepository _repo;

  @override
  Future<Result<ProofDownloadLink>> call(String depositId) =>
      _repo.getProofDownloadLink(depositId);
}
