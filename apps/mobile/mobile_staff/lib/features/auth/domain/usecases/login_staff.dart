import 'package:core/core_domain.dart';

import '../repositories/staff_auth_repository.dart';

class LoginParams {
  const LoginParams({required this.email, required this.password});
  final String email;
  final String password;
}

class LoginStaff implements UseCase<Session, LoginParams> {
  const LoginStaff(this._repo);
  final StaffAuthRepository _repo;

  @override
  Future<Result<Session>> call(LoginParams params) =>
      _repo.loginWithEmail(params.email, params.password);
}
