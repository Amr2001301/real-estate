import 'package:core/core_domain.dart';

import '../entities/user_profile.dart';
import '../repositories/profile_repository.dart';

class GetMyProfile implements UseCase<UserProfile, NoParams> {
  const GetMyProfile(this._repo);
  final ProfileRepository _repo;

  @override
  Future<Result<UserProfile>> call(NoParams params) => _repo.getProfile();
}
