import 'package:core/core_domain.dart';

import '../repositories/staff_auth_repository.dart';

class LogoutStaff implements UseCase<void, NoParams> {
  const LogoutStaff(this._repo);
  final StaffAuthRepository _repo;

  @override
  Future<Result<void>> call(NoParams params) => _repo.logout();
}
