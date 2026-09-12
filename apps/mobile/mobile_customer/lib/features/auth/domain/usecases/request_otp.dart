import 'package:core/core_domain.dart';

import '../repositories/auth_repository.dart';

class OtpRequestParams {
  const OtpRequestParams({required this.slug, required this.phone});
  final String slug;
  final String phone;
}

/// Requests a tenant-scoped OTP code for the given phone number.
class RequestOtp implements UseCase<void, OtpRequestParams> {
  const RequestOtp(this._repo);
  final AuthRepository _repo;

  @override
  Future<Result<void>> call(OtpRequestParams params) =>
      _repo.requestOtp(params.slug, params.phone);
}
