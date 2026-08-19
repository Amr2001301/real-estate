import 'package:core/core_domain.dart';

import '../repositories/auth_repository.dart';

class ResetPasswordParams {
  const ResetPasswordParams({required this.token, required this.newPassword});
  final String token;
  final String newPassword;
}

class ResetPassword implements UseCase<void, ResetPasswordParams> {
  const ResetPassword(this._repo);
  final AuthRepository _repo;

  @override
  Future<Result<void>> call(ResetPasswordParams params) =>
      _repo.resetPassword(params.token, params.newPassword);
}
