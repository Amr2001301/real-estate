import 'package:freezed_annotation/freezed_annotation.dart';

import 'app_role.dart';

part 'session.freezed.dart';
part 'session.g.dart';

/// The authenticated user's identity + role. Persisted (as JSON) in secure
/// storage alongside the tokens, so the session survives app restarts.
@freezed
abstract class Session with _$Session {
  const factory Session({
    required String userId,
    @AppRoleConverter() required AppRole role,
    String? email,
    String? phone,
    String? displayName,
    /// BRK-6c: the company's type (`DEVELOPER` | `BROKERAGE`). A brokerage
    /// gets its own screens; null on sessions saved before this field.
    String? companyType,
  }) = _Session;

  factory Session.fromJson(Map<String, dynamic> json) => _$SessionFromJson(json);
}
