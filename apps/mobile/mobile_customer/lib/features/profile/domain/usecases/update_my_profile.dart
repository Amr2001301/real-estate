import 'package:core/core_domain.dart';

import '../entities/user_profile.dart';
import '../repositories/profile_repository.dart';

class UpdateMyProfile implements UseCase<UserProfile, UpdateProfileParams> {
  const UpdateMyProfile(this._repo);
  final ProfileRepository _repo;

  @override
  Future<Result<UserProfile>> call(UpdateProfileParams params) =>
      _repo.updateProfile(params);
}
