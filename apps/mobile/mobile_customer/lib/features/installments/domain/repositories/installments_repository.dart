import 'dart:typed_data';

import 'package:core/core_domain.dart';

import '../entities/installment.dart';

/// Submission payload for a fresh proof against an unpaid installment.
class SubmitProofParams {
  const SubmitProofParams({
    required this.installmentId,
    required this.amount,
    required this.paidAt,
    required this.method,
    required this.bytes,
    required this.fileName,
    required this.mimeType,
    this.note,
  });

  final String installmentId;
  final num amount;
  final DateTime paidAt;
  final PaymentMethod method;
  final Uint8List bytes;
  final String fileName;
  final String mimeType;
  final String? note;
}

/// Resubmission payload (for a deposit currently in REJECTED). Same file
/// constraints as the first-time submission; the backend rebuilds the
/// review row in PENDING_REVIEW.
class ResubmitProofParams {
  const ResubmitProofParams({
    required this.depositId,
    required this.method,
    required this.bytes,
    required this.fileName,
    required this.mimeType,
    this.paidAt,
    this.note,
  });

  final String depositId;
  final PaymentMethod method;
  final Uint8List bytes;
  final String fileName;
  final String mimeType;
  final DateTime? paidAt;
  final String? note;
}

abstract interface class InstallmentsRepository {
  /// Returns the customer's full installment schedule. The repository
  /// merges /me/installments with /me/deposits so each row carries its
  /// latest proof status when one exists.
  Future<Result<List<Installment>>> getMyInstallments();

  /// First-time proof submission. Three-step orchestration:
  ///   1) POST /me/payments/presign
  ///   2) PUT bytes to the signed URL (interceptor-free Dio)
  ///   3) POST /me/deposits
  /// Backend enforces ownership + amount equality; the repo just relays
  /// failures via Result.
  Future<Result<void>> submitProof(SubmitProofParams params);

  /// Resubmission against a REJECTED deposit. Same 3-step shape but step
  /// (3) POSTs to /me/deposits/:id/resubmit.
  Future<Result<void>> resubmitProof(ResubmitProofParams params);
}
