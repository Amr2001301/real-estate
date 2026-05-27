import 'package:core/core_domain.dart';

import '../repositories/auth_repository.dart';

class LoginParams {
  const LoginParams({required this.email, required this.password});
  final String email;
  final String password;
}

/// Logs a customer in with email + password.
class LoginWithEmail implements UseCase<Session, LoginParams> {
  const LoginWithEmail(this._repo);
  final AuthRepository _repo;

  @override
  Future<Result<Session>> call(LoginParams params) =>
      _repo.loginWithEmail(params.email, params.password);
}
