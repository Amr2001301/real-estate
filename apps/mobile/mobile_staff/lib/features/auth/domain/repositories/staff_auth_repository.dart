import 'package:core/core_domain.dart';

/// Domain contract for staff authentication. Returns the authenticated
/// [Session] on success (the implementation persists tokens + selected company
/// slug to secure storage). Always returns [Result] with [AppFailure] — never
/// raw exceptions.
abstract interface class StaffAuthRepository {
  /// Tenant-aware login. Calls POST /auth/login-staff. The selected company
  /// slug is persisted on success for X-Tenant-Slug header and session restore.
  Future<Result<Session>> loginWithSlug(String slug, String email, String password);

  /// Refreshes tokens using the stored refresh token (used by the 401
  /// interceptor). Fails if no refresh token is stored.
  Future<Result<Session>> refreshSession();

  /// Revokes the refresh token server-side (best-effort) and clears all
  /// session state (tokens, session JSON, selected company slug).
  Future<Result<void>> logout();

  Future<Result<void>> forgotPassword(String email);
  Future<Result<void>> resetPassword(String token, String newPassword);
}
