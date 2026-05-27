import 'package:core/core_domain.dart';

import '../dtos/auth_dtos.dart';

/// Maps the auth user DTO → the core [Session] domain entity.
extension AuthUserDtoMapper on AuthUserDto {
  Session toSession() => Session(
        userId: id,
        role: AppRole.fromWire(role),
        email: email,
        phone: phone,
        displayName: fullName,
      );
}

extension AuthBundleDtoMapper on AuthBundleDto {
  Session toSession() => user.toSession();
}
