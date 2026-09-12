import 'package:core/core_domain.dart';

import '../repositories/staff_auth_repository.dart';

class LoginParams {
  const LoginParams({
    required this.slug,
    required this.email,
    required this.password,
  });

  /// The company code entered by the user. Passed to POST /auth/login-staff.
  /// Never exposed as authorization authority — backend resolves tenant from
  /// the slug server-side.
  final String slug;
  final String email;
  final String password;
}

class LoginStaff implements UseCase<Session, LoginParams> {
  const LoginStaff(this._repo);
  final StaffAuthRepository _repo;

  @override
  Future<Result<Session>> call(LoginParams params) =>
      _repo.loginWithSlug(params.slug, params.email, params.password);
}
