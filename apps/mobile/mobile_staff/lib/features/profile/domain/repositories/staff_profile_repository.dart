import 'package:core/core_domain.dart';

import '../entities/staff_profile.dart';

abstract interface class StaffProfileRepository {
  Future<Result<StaffProfile>> getMyProfile();
}
