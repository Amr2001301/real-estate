import 'package:core/core_domain.dart';

import '../repositories/auth_repository.dart';

class VerifyOtpParams {
  const VerifyOtpParams({required this.phone, required this.code, this.fullName});
  final String phone;
  final String code;
  final String? fullName;
}

/// Verifies an OTP code (creating the account on first verify) and signs in.
class VerifyOtp implements UseCase<Session, VerifyOtpParams> {
  const VerifyOtp(this._repo);
  final AuthRepository _repo;

  @override
  Future<Result<Session>> call(VerifyOtpParams params) =>
      _repo.verifyOtp(params.phone, params.code, fullName: params.fullName);
}
