import 'package:core/core_domain.dart';

import '../repositories/auth_repository.dart';

class LoginParams {
  const LoginParams({
    required this.slug,
    required this.email,
    required this.password,
  });
  final String slug;
  final String email;
  final String password;
}

/// Logs a customer in with email + password against the selected company.
class LoginWithEmail implements UseCase<Session, LoginParams> {
  const LoginWithEmail(this._repo);
  final AuthRepository _repo;

  @override
  Future<Result<Session>> call(LoginParams params) =>
      _repo.loginWithEmail(params.slug, params.email, params.password);
}
