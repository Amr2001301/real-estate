import 'package:core/core_domain.dart';

import '../repositories/auth_repository.dart';

class ForgotPassword implements UseCase<void, String> {
  const ForgotPassword(this._repo);
  final AuthRepository _repo;

  @override
  Future<Result<void>> call(String email) => _repo.forgotPassword(email);
}
