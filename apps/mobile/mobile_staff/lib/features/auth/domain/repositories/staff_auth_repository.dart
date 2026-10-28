import 'package:core/core_domain.dart';

import '../entities/staff_two_factor.dart';

/// Domain contract for staff authentication. Returns the authenticated
/// [Session] on success (the implementation persists tokens + selected company
/// slug to secure storage). Always returns [Result] with [AppFailure] — never
/// raw exceptions.
abstract interface class StaffAuthRepository {
  /// Tenant-aware login. Calls POST /auth/login-staff. The selected company
  /// slug is persisted on success for X-Tenant-Slug header and session restore.
  /// TFA1 — an account with two-step sign-in gets the second step instead.
  Future<Result<StaffLoginOutcome>> loginWithSlug(String slug, String email, String password);

  /// TFA1 — the second step; on success the session is persisted under [slug].
  Future<Result<Session>> verifyTwoFactor(String challenge, String code, String slug);

  /// TFA1 — setting it up while signing in, where the company requires it.
  Future<Result<StaffTwoFactorSetup>> startTwoFactorSetup(String challenge);
  Future<Result<StaffTwoFactorEnabled>> finishTwoFactorSetup(String challenge, String code, String slug);

  /// Refreshes tokens using the stored refresh token (used by the 401
  /// interceptor). Fails if no refresh token is stored.
  Future<Result<Session>> refreshSession();

  /// Revokes the refresh token server-side (best-effort) and clears all
  /// session state (tokens, session JSON, selected company slug).
  Future<Result<void>> logout();

  Future<Result<void>> forgotPassword(String email);
  Future<Result<void>> resetPassword(String token, String newPassword);
}
