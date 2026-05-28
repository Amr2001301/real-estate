import 'package:core/core.dart';

import '../../domain/entities/staff_profile.dart';
import '../../domain/repositories/staff_profile_repository.dart';
import '../datasources/staff_profile_remote_data_source.dart';
import '../mappers/staff_profile_mapper.dart';

class StaffProfileRepositoryImpl implements StaffProfileRepository {
  StaffProfileRepositoryImpl(this._remote);
  final StaffProfileRemoteDataSource _remote;

  @override
  Future<Result<StaffProfile>> getMyProfile() {
    return guardApiCall(() async => (await _remote.getMyProfile()).toEntity());
  }
}
