import 'package:core/core_domain.dart';

import '../../domain/entities/user_profile.dart';
import '../dtos/user_profile_dto.dart';

extension UserProfileDtoMapper on UserProfileDto {
  UserProfile toEntity() => UserProfile(
        id: id,
        role: AppRole.fromWire(role),
        fullName: fullName,
        email: email,
        phone: phone,
        locale: locale,
      );
}
