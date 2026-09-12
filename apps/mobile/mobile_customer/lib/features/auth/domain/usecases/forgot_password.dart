import 'package:core/core_domain.dart';

import '../repositories/auth_repository.dart';

class ForgotPasswordParams {
  const ForgotPasswordParams({required this.slug, required this.email});
  final String slug;
  final String email;
}

/// Sends a tenant-scoped password-reset email.
class ForgotPassword implements UseCase<void, ForgotPasswordParams> {
  const ForgotPassword(this._repo);
  final AuthRepository _repo;

  @override
  Future<Result<void>> call(ForgotPasswordParams params) =>
      _repo.forgotPassword(params.slug, params.email);
}
