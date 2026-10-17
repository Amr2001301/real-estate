import 'package:core/core.dart';

import '../../domain/entities/user_profile.dart';
import '../../domain/repositories/profile_repository.dart';
import '../datasources/profile_remote_data_source.dart';
import '../mappers/profile_mapper.dart';

class ProfileRepositoryImpl implements ProfileRepository {
  ProfileRepositoryImpl(this._remote);
  final ProfileRemoteDataSource _remote;

  @override
  Future<Result<UserProfile>> getProfile() {
    return guardApiCall(() async => (await _remote.getMe()).toEntity());
  }

  @override
  Future<Result<UserProfile>> updateProfile(UpdateProfileParams params) {
    return guardApiCall(() async {
      final dto = await _remote.updateMe({
        'fullName': ?params.fullName,
        'phone': ?params.phone,
        'locale': ?params.locale,
      });
      return dto.toEntity();
    });
  }

  @override
  Future<Result<void>> requestPhoneChange(String phone) {
    return guardApiCall(() => _remote.requestPhoneChange(phone));
  }

  @override
  Future<Result<void>> confirmPhoneChange(String code) {
    return guardApiCall(() => _remote.confirmPhoneChange(code));
  }

  @override
  Future<Result<void>> deleteAccount() {
    return guardApiCall(() => _remote.deleteMe());
  }
}
