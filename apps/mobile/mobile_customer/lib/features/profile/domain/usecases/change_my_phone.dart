import 'package:core/core_domain.dart';

import '../repositories/profile_repository.dart';

/// Sends a code to the new number (the account keeps its phone until then).
class RequestPhoneChange implements UseCase<void, String> {
  const RequestPhoneChange(this._repo);
  final ProfileRepository _repo;

  @override
  Future<Result<void>> call(String phone) => _repo.requestPhoneChange(phone);
}

/// The code sent to the new number: the phone changes now.
class ConfirmPhoneChange implements UseCase<void, String> {
  const ConfirmPhoneChange(this._repo);
  final ProfileRepository _repo;

  @override
  Future<Result<void>> call(String code) => _repo.confirmPhoneChange(code);
}
