import 'package:core/core_domain.dart';

import '../repositories/installments_repository.dart';

class SubmitPaymentProof implements UseCase<void, SubmitProofParams> {
  const SubmitPaymentProof(this._repo);
  final InstallmentsRepository _repo;

  @override
  Future<Result<void>> call(SubmitProofParams params) =>
      _repo.submitProof(params);
}

class ResubmitPaymentProof implements UseCase<void, ResubmitProofParams> {
  const ResubmitPaymentProof(this._repo);
  final InstallmentsRepository _repo;

  @override
  Future<Result<void>> call(ResubmitProofParams params) =>
      _repo.resubmitProof(params);
}
