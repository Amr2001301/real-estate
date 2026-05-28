import 'package:core/core_domain.dart';

import '../entities/staff_profile.dart';
import '../repositories/staff_profile_repository.dart';

class GetStaffProfile implements UseCase<StaffProfile, NoParams> {
  const GetStaffProfile(this._repo);
  final StaffProfileRepository _repo;

  @override
  Future<Result<StaffProfile>> call(NoParams params) => _repo.getMyProfile();
}
