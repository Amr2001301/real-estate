import 'package:core/core_domain.dart';

import '../repositories/auth_repository.dart';

/// Requests an OTP code for the given phone number.
class RequestOtp implements UseCase<void, String> {
  const RequestOtp(this._repo);
  final AuthRepository _repo;

  @override
  Future<Result<void>> call(String phone) => _repo.requestOtp(phone);
}
