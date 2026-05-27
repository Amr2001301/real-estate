import 'package:core/core_domain.dart';

import '../repositories/auth_repository.dart';

/// Refreshes the session using the stored refresh token. Wired into the 401
/// interceptor in DI.
class RefreshSession implements UseCase<Session, NoParams> {
  const RefreshSession(this._repo);
  final AuthRepository _repo;

  @override
  Future<Result<Session>> call(NoParams params) => _repo.refreshSession();
}
