import 'package:core/core_domain.dart';

import '../repositories/staff_auth_repository.dart';

class ForgotStaffPassword implements UseCase<void, String> {
  const ForgotStaffPassword(this._repo);
  final StaffAuthRepository _repo;

  @override
  Future<Result<void>> call(String email) => _repo.forgotPassword(email);
}

class ResetStaffPasswordParams {
  const ResetStaffPasswordParams({required this.token, required this.newPassword});
  final String token;
  final String newPassword;
}

class ResetStaffPassword implements UseCase<void, ResetStaffPasswordParams> {
  const ResetStaffPassword(this._repo);
  final StaffAuthRepository _repo;

  @override
  Future<Result<void>> call(ResetStaffPasswordParams params) =>
      _repo.resetPassword(params.token, params.newPassword);
}
