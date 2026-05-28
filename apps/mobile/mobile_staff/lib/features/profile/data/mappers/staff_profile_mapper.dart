import 'package:core/core_domain.dart';

import '../../domain/entities/staff_profile.dart';
import '../dtos/staff_profile_dto.dart';

extension StaffProfileDtoMapper on StaffProfileDto {
  StaffProfile toEntity() => StaffProfile(
        id: id,
        role: AppRole.fromWire(role),
        fullName: fullName,
        email: email,
        phone: phone,
      );
}
