import 'package:core/core_domain.dart';

/// Domain contract for staff authentication. Returns the authenticated
/// [Session] on success (the implementation persists tokens to secure
/// storage). Always returns [Result] with [AppFailure] — never raw exceptions.
abstract interface class StaffAuthRepository {
  Future<Result<Session>> loginWithEmail(String email, String password);

  /// Refreshes tokens using the stored refresh token (used by the 401
  /// interceptor). Fails if no refresh token is stored.
  Future<Result<Session>> refreshSession();

  /// Revokes the refresh token server-side (best-effort) and clears storage.
  Future<Result<void>> logout();
}
