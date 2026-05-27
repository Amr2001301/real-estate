import 'package:core/core_domain.dart';

import '../repositories/auth_repository.dart';

/// Logs the user out (revokes refresh token server-side, clears storage).
class LogoutUser implements UseCase<void, NoParams> {
  const LogoutUser(this._repo);
  final AuthRepository _repo;

  @override
  Future<Result<void>> call(NoParams params) => _repo.logout();
}
