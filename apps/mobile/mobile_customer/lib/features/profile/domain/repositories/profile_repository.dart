import 'package:core/core_domain.dart';

import '../entities/user_profile.dart';

class UpdateProfileParams {
  const UpdateProfileParams({this.fullName, this.phone, this.locale});
  final String? fullName;
  final String? phone;
  final String? locale;
}

abstract interface class ProfileRepository {
  Future<Result<UserProfile>> getProfile();
  Future<Result<UserProfile>> updateProfile(UpdateProfileParams params);
}
