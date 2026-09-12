import 'package:core/core_domain.dart';

import '../repositories/auth_repository.dart';

class VerifyOtpParams {
  const VerifyOtpParams({
    required this.slug,
    required this.phone,
    required this.code,
    this.fullName,
  });
  final String slug;
  final String phone;
  final String code;
  final String? fullName;
}

/// Verifies a tenant-scoped OTP code (creating the account on first verify).
class VerifyOtp implements UseCase<Session, VerifyOtpParams> {
  const VerifyOtp(this._repo);
  final AuthRepository _repo;

  @override
  Future<Result<Session>> call(VerifyOtpParams params) =>
      _repo.verifyOtp(params.slug, params.phone, params.code, fullName: params.fullName);
}
